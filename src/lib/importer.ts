import { decodeHtml, stripTags } from "@/lib/html";
import {
  INSTAGRAM_FALLBACK_TITLE,
  canonicalInstagramUrl,
  fetchInstagramData,
  isInstagramHost,
  parseInstagramCaption,
  resolveInstagramShortcode,
} from "@/lib/instagram";
import { ImportPreview, ImportMeta, SourceType } from "@/lib/types";

const WEB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function makeImportMeta(meta: Partial<ImportMeta>): ImportMeta {
  return {
    rawContent: meta.rawContent ?? null,
    parserResult: meta.parserResult ?? {},
    confidence: meta.confidence ?? "low",
    status: meta.status ?? "failed",
    lastImportAttemptAt: new Date().toISOString(),
  };
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

function getMetaContent(html: string, key: string) {
  // Match double- and single-quoted attributes separately so apostrophes inside
  // a double-quoted description don't cut the value short.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content="([^"]*)"[^>]*>`, "i"),
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content='([^']*)'[^>]*>`, "i"),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content='([^']*)'[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return "";
}

function makeFallbackTitle(url: URL, sourceType: SourceType) {
  if (sourceType === "instagram_reel") {
    return INSTAGRAM_FALLBACK_TITLE;
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

function getSchemaImage(schema: Record<string, unknown> | undefined) {
  const image = schema?.image;
  if (typeof image === "string") {
    return image;
  }
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object" && "url" in first) {
      return String((first as { url: unknown }).url);
    }
  }
  if (image && typeof image === "object" && "url" in image) {
    return String((image as { url: unknown }).url);
  }
  return "";
}

export function sourceTypeForUrl(url: URL): SourceType {
  return isInstagramHost(url.hostname) ? "instagram_reel" : "web";
}

async function buildWebPreview(urlInput: string, url: URL): Promise<ImportPreview> {
  const domain = url.hostname.replace(/^www\./, "");

  try {
    const response = await fetch(urlInput, {
      headers: { "user-agent": WEB_USER_AGENT, "accept-language": "en-US,en;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
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
      (typeof schema?.name === "string" && decodeHtml(schema.name)) ||
      openGraphTitle ||
      makeFallbackTitle(url, "web");
    const summary =
      (typeof schema?.description === "string" && decodeHtml(schema.description)) ||
      openGraphDescription ||
      "";
    const coverImageUrl = getSchemaImage(schema) || openGraphImage || "";

    return {
      sourceType: "web",
      sourceUrl: urlInput,
      sourceDomain: domain,
      title,
      coverImageUrl,
      summary,
      ingredients,
      notes: "",
      importMeta: makeImportMeta({
        rawContent: html.slice(0, 4000),
        parserResult: {
          schemaTitle: typeof schema?.name === "string" ? schema.name : null,
          openGraphTitle,
          ingredientCount: ingredients.length,
          httpStatus: response.status,
        },
        confidence: schemaIngredients.length > 0 ? "high" : "medium",
        status: ingredients.length > 0 || Boolean(summary) ? "success" : "partial",
      }),
    };
  } catch (error) {
    return {
      sourceType: "web",
      sourceUrl: urlInput,
      sourceDomain: domain,
      title: makeFallbackTitle(url, "web"),
      coverImageUrl: "",
      summary: "",
      ingredients: [],
      notes: "",
      importMeta: makeImportMeta({
        parserResult: { error: error instanceof Error ? error.message : "Unknown import error" },
        confidence: "low",
        status: "failed",
      }),
    };
  }
}

export type InstagramCaptionInput = {
  caption: string;
  imageUrl?: string;
  author?: string;
  fallbackTitle?: string;
  source: string;
  extra?: Record<string, unknown>;
};

// Turns a Reel caption into a preview. Shared by the link importer and the
// browser-extension capture flow.
export async function buildInstagramPreviewFromCaption(
  sourceUrl: string,
  input: InstagramCaptionInput,
): Promise<ImportPreview> {
  const parsed = parseInstagramCaption(input.caption);
  let ingredients = parsed.ingredients;
  let summary = parsed.method;
  let coverImageUrl = input.imageUrl ?? "";
  let linkedRecipe: string | null = null;

  // Many creators put the ingredients on their blog and link it in the caption.
  if (ingredients.length === 0 && parsed.links.length > 0) {
    const link = parsed.links[0];
    try {
      const linked = await buildWebPreview(link, new URL(link));
      if (linked.ingredients.length > 0) {
        ingredients = linked.ingredients;
        summary = summary || linked.summary;
        coverImageUrl = coverImageUrl || linked.coverImageUrl;
        linkedRecipe = link;
      }
    } catch {
      // Ignore; the Reel itself still imports.
    }
  }

  const title = parsed.title || input.fallbackTitle || INSTAGRAM_FALLBACK_TITLE;
  const notesParts = [
    input.author ? `Reel by @${input.author.replace(/^@/, "")}` : "",
    linkedRecipe ? `Full recipe: ${linkedRecipe}` : parsed.links[0] ? `Link from caption: ${parsed.links[0]}` : "",
  ].filter(Boolean);

  const hasCaption = input.caption.trim().length > 0;
  const status: ImportMeta["status"] = ingredients.length > 0 ? "success" : hasCaption || coverImageUrl ? "partial" : "failed";

  return {
    sourceType: "instagram_reel",
    sourceUrl,
    sourceDomain: "instagram.com",
    title,
    coverImageUrl,
    summary,
    ingredients,
    notes: notesParts.join("\n"),
    importMeta: makeImportMeta({
      rawContent: hasCaption ? input.caption.slice(0, 4000) : null,
      parserResult: {
        source: input.source,
        author: input.author || null,
        ingredientCount: ingredients.length,
        ingredientsFrom: linkedRecipe ? "linked_recipe" : ingredients.length > 0 ? "caption" : null,
        linkedRecipe,
        ...input.extra,
      },
      confidence: ingredients.length > 0 ? (linkedRecipe ? "high" : "medium") : "low",
      status,
    }),
  };
}

async function buildInstagramPreview(urlInput: string, url: URL): Promise<ImportPreview> {
  const info = await resolveInstagramShortcode(url);

  if (!info) {
    return {
      sourceType: "instagram_reel",
      sourceUrl: urlInput,
      sourceDomain: "instagram.com",
      title: INSTAGRAM_FALLBACK_TITLE,
      coverImageUrl: "",
      summary: "",
      ingredients: [],
      notes: "",
      importMeta: makeImportMeta({
        parserResult: { error: "Could not find a Reel or post ID in this link" },
        confidence: "low",
        status: "failed",
      }),
    };
  }

  const sourceUrl = canonicalInstagramUrl(info);
  const data = await fetchInstagramData(info);

  return buildInstagramPreviewFromCaption(sourceUrl, {
    caption: data.caption,
    imageUrl: data.imageUrl,
    author: data.author,
    source: data.source,
    extra: {
      shortcode: info.shortcode,
      loginWall: data.loginWall,
      ...(data.error && data.source === "none" ? { error: data.error } : {}),
    },
  });
}

export async function buildImportPreview(urlInput: string): Promise<ImportPreview> {
  let url: URL;
  try {
    url = new URL(urlInput.trim());
  } catch {
    return {
      sourceType: "web",
      sourceUrl: urlInput,
      sourceDomain: "",
      title: "Untitled recipe",
      coverImageUrl: "",
      summary: "",
      ingredients: [],
      notes: "",
      importMeta: makeImportMeta({
        parserResult: { error: "That doesn't look like a valid link" },
        confidence: "low",
        status: "failed",
      }),
    };
  }

  return sourceTypeForUrl(url) === "instagram_reel"
    ? buildInstagramPreview(url.toString(), url)
    : buildWebPreview(url.toString(), url);
}
