import { ImportPreview, ImportMeta, SourceType } from "@/lib/types";

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function makeImportMeta(meta: Partial<ImportMeta>): ImportMeta {
  return {
    rawContent: meta.rawContent ?? null,
    parserResult: meta.parserResult ?? {},
    confidence: meta.confidence ?? "low",
    status: meta.status ?? "failed",
    lastImportAttemptAt: new Date().toISOString(),
  };
}

function cleanInstagramTitle(value: string) {
  const decoded = decodeHtml(value).trim();
  const quotedMatch = decoded.match(/^[^:]+ on Instagram:\s*["“](.+?)["”]\s*$/i);
  const titleSource = quotedMatch?.[1] ?? decoded.replace(/^[^:]+ on Instagram:\s*/i, "");

  return titleSource
    .replace(/\bingredients?\b[\s\S]*$/i, "")
    .replace(/\bmethod\b[\s\S]*$/i, "")
    .replace(/\binstructions?\b[\s\S]*$/i, "")
    .replace(/\s*[|•]\s*[\s\S]*$/i, "")
    .replace(/\s+on Instagram(?::.*)?$/i, "")
    .replace(/^Instagram:\s*/i, "")
    .replace(/^["“'`]+|["”'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (item && typeof item === "object" && "text" in item) {
          return String(item.text).trim();
        }

        if (item && typeof item === "object" && "name" in item) {
          return String(item.name).trim();
        }

        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\n|•|\. /)
      .map((item) => item.trim())
      .filter((item) => item.length > 2);
  }

  return [];
}

function cleanCaptionLine(value: string) {
  return value
    .replace(/^[\s\-*•·▪▫◦]+/, "")
    .replace(/^[0-9]+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeIngredient(value: string) {
  return /^((\d+([/.]\d+)?)|(\d+\s\d+\/\d+)|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\b/i.test(
    value,
  ) || /\b(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|kg|ml|l|clove|cloves|slice|slices|can|cans|package|packages)\b/i.test(
    value,
  );
}

export function extractIngredientsFromCaption(caption: string) {
  const normalized = caption.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  const lower = normalized.toLowerCase();
  const ingredientsMatch = lower.match(/ingredients?\s*:?/i);
  const directionsMatch = lower.match(
    /(instructions?|directions?|method|how to make|steps?)\s*:?/i,
  );

  let workingText = normalized;

  if (ingredientsMatch?.index !== undefined) {
    workingText = normalized.slice(ingredientsMatch.index + ingredientsMatch[0].length).trim();
  }

  if (directionsMatch?.index !== undefined) {
    const boundary = directionsMatch.index - (ingredientsMatch?.index ?? 0) - (ingredientsMatch?.[0].length ?? 0);
    if (boundary > 0 && boundary < workingText.length) {
      workingText = workingText.slice(0, boundary).trim();
    }
  }

  const lines = workingText
    .split("\n")
    .map(cleanCaptionLine)
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !/^follow\b|^save\b|^full recipe\b|^link in bio\b|^credit\b/i.test(line));

  const ingredientLines = lines.filter((line) => looksLikeIngredient(line));
  if (ingredientLines.length > 0) {
    return ingredientLines;
  }

  const inlineIngredients = workingText
    .split(/,|\u2022|•/)
    .map(cleanCaptionLine)
    .filter(Boolean)
    .filter((line) => looksLikeIngredient(line));

  return inlineIngredients;
}

function toArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getSchemaCandidates(html: string) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];

  return matches
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      try {
        const parsed = JSON.parse(chunk ?? "null");
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    })
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const graph = "@" in item && item["@graph"];
      return Array.isArray(graph) ? graph : [item];
    });
}

function pickRecipeSchema(candidates: unknown[]) {
  return candidates.find((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const rawType = (candidate as { "@type"?: string | string[] })["@type"];
    return toArray(rawType).some((entry) => String(entry).toLowerCase() === "recipe");
  }) as Record<string, unknown> | undefined;
}

function getMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return "";
}

function findTextList(html: string, label: string) {
  const sectionMatch = html.match(
    new RegExp(`${label}[\\s\\S]{0,1800}<\\/ul>`, "i"),
  );

  if (!sectionMatch) {
    return [];
  }

  return [...sectionMatch[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1] ?? ""))
    .filter(Boolean);
}

function makeFallbackTitle(url: URL, sourceType: SourceType) {
  if (sourceType === "instagram_reel") {
    return "Saved Instagram Reel";
  }

  const slug = url.pathname
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]+/g, " ")
    .trim();

  if (!slug) {
    return `Recipe from ${url.hostname.replace(/^www\./, "")}`;
  }

  return slug.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function buildImportPreview(urlInput: string): Promise<ImportPreview> {
  const url = new URL(urlInput);
  const domain = url.hostname.replace(/^www\./, "");
  const sourceType: SourceType = /instagram\.com$/.test(domain)
    ? "instagram_reel"
    : "web";

  try {
    const response = await fetch(urlInput, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; KitchenReelBot/1.0; +https://example.com)",
      },
      next: { revalidate: 0 },
    });
    const html = await response.text();

    const schema = pickRecipeSchema(getSchemaCandidates(html));
    const openGraphTitle = getMetaContent(html, "og:title");
    const openGraphDescription = getMetaContent(html, "og:description");
    const openGraphImage = getMetaContent(html, "og:image");

    const schemaIngredients = normalizeList(schema?.recipeIngredient);
    const ingredients =
      schemaIngredients.length > 0 ? schemaIngredients : findTextList(html, "ingredients");

    const title =
      sourceType === "instagram_reel"
        ? cleanInstagramTitle(openGraphTitle) || makeFallbackTitle(url, sourceType)
        : (typeof schema?.name === "string" && schema.name) ||
          openGraphTitle ||
          makeFallbackTitle(url, sourceType);
    const summary =
      sourceType === "instagram_reel"
        ? ""
        : (typeof schema?.description === "string" && schema.description) ||
          openGraphDescription ||
          "";
    const coverImageUrl =
      (typeof schema?.image === "string" && schema.image) ||
      (Array.isArray(schema?.image) && typeof schema?.image[0] === "string" ? schema.image[0] : "") ||
      openGraphImage ||
      "";

    const parserResult = {
      schemaTitle: typeof schema?.name === "string" ? schema.name : null,
      openGraphTitle,
      ingredientCount: ingredients.length,
    };

    if (sourceType === "instagram_reel") {
      return {
        sourceType,
        sourceUrl: urlInput,
        sourceDomain: domain,
        title,
        coverImageUrl,
        summary,
        ingredients,
        notes: "",
        importMeta: makeImportMeta({
          rawContent: html.slice(0, 4000),
          parserResult,
          confidence: title !== "Saved Instagram Reel" || coverImageUrl ? "medium" : "low",
          status: title !== "Saved Instagram Reel" || coverImageUrl ? "partial" : "failed",
        }),
      };
    }

    return {
      sourceType,
      sourceUrl: urlInput,
      sourceDomain: domain,
      title,
      coverImageUrl,
      summary,
      ingredients,
      notes: "",
      importMeta: makeImportMeta({
        rawContent: html.slice(0, 4000),
        parserResult,
        confidence: schemaIngredients.length > 0 ? "high" : "medium",
        status: ingredients.length > 0 || Boolean(summary) ? "success" : "partial",
      }),
    };
  } catch (error) {
    return {
      sourceType,
      sourceUrl: urlInput,
      sourceDomain: domain,
      title: makeFallbackTitle(url, sourceType),
      coverImageUrl: "",
      summary: "",
      ingredients: [],
      notes: "",
      importMeta: makeImportMeta({
        rawContent: null,
        parserResult: {
          error: error instanceof Error ? error.message : "Unknown import error",
        },
        confidence: "low",
        status: "failed",
      }),
    };
  }
}
