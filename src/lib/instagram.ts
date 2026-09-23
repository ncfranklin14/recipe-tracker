// Instagram Reel / post import helpers.
//
// Instagram redirects most server-side requests for a post page to its login
// wall, so the Open Graph tags on /p/<id>/ are usually just "Instagram" plus
// the Instagram logo. The public embed page (/p/<id>/embed/captioned/) is
// still served without a login and contains the full caption and cover image,
// so we read that first and only fall back to the post page's meta tags.

import { decodeHtml } from "@/lib/html";

export const INSTAGRAM_FALLBACK_TITLE = "Saved Instagram Reel";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const LINK_PREVIEW_USER_AGENT =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

const FETCH_TIMEOUT_MS = 10_000;

export function isInstagramHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
}

type ShortcodeInfo = { kind: "p" | "reel" | "tv"; shortcode: string };

export function parseInstagramShortcode(url: URL | string): ShortcodeInfo | null {
  const pathname = typeof url === "string" ? new URL(url).pathname : url.pathname;
  const match = pathname.match(/\/(p|reels?|tv)\/([A-Za-z0-9_-]{5,})/);
  if (!match) {
    return null;
  }

  const rawKind = match[1];
  const kind = rawKind === "p" ? "p" : rawKind === "tv" ? "tv" : "reel";
  return { kind, shortcode: match[2] };
}

export function canonicalInstagramUrl(info: ShortcodeInfo) {
  return `https://www.instagram.com/${info.kind}/${info.shortcode}/`;
}

// ---------------------------------------------------------------------------
// Caption parsing
// ---------------------------------------------------------------------------

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const BULLET_PATTERN = /^\s*(?:[-*•·▪▫◦–—✔✓✅🔸🔹▶►→]|\d+[.)])\s*/u;
const FRACTIONS = "¼½¾⅓⅔⅛⅜⅝⅞";
const UNIT_PATTERN =
  /\b(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|litres?|liters?|cloves?|slices?|cans?|tins?|packages?|pinch|dash|handful|bunch|sticks?|heads?|stalks?|sprigs?|inch|large|small|medium)\b/i;

const INGREDIENT_HEADER = /^(ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need|shopping list)\b/i;
const METHOD_HEADER =
  /^(instructions?|directions?|method|how to make(?: it)?|steps?|preparation|to make|recipe steps?)\b/i;
const CTA_PATTERN =
  /^(follow|save|share|tag|comment|like|full recipe|recipe (?:is )?(?:in|on)|link in (?:my )?bio|credit|dm\b|subscribe|check out)/i;

function stripEmoji(value: string) {
  return value.replace(EMOJI_PATTERN, "").replace(/\s+/g, " ").trim();
}

function headerText(line: string) {
  // "INGREDIENTS ⬇️", "Ingredients:", "~ Method ~" -> "ingredients", "method"
  return stripEmoji(line)
    .replace(/^[^\p{L}]+/u, "")
    .replace(/[\s:.\-–—~*⬇↓👇]+$/u, "")
    .trim();
}

function isHeader(line: string, pattern: RegExp) {
  const text = headerText(line);
  if (text.length > 0 && text.length <= 40 && pattern.test(text)) {
    return true;
  }

  // Inline form: "Ingredients: 2 eggs, 1 cup flour"
  const colon = line.indexOf(":");
  if (colon > 0) {
    const label = headerText(line.slice(0, colon));
    return label.length > 0 && label.length <= 40 && pattern.test(label);
  }

  return false;
}

function isBulleted(line: string) {
  return BULLET_PATTERN.test(line);
}

function cleanLine(line: string) {
  return line.replace(BULLET_PATTERN, "").replace(/\s+/g, " ").trim();
}

export function looksLikeIngredient(value: string) {
  const text = value.trim();
  if (!text || text.length > 140) {
    return false;
  }

  const startsWithQuantity = new RegExp(
    `^((\\d+([/.,]\\d+)?)|[${FRACTIONS}]|(\\d+\\s*[${FRACTIONS}])|(\\d+\\s\\d+/\\d+)|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half|a few|a pinch|a handful)(?![a-z])`,
    "i",
  ).test(text);

  return startsWithQuantity || UNIT_PATTERN.test(text) || new RegExp(`\\d\\s*[${FRACTIONS}]?\\s*(g|kg|ml|l)\\b`, "i").test(text);
}

function isSubheading(line: string) {
  // Short label lines inside an ingredient list: "Chicken", "Ramen broth:",
  // "For the sauce", "Garnish".
  const text = headerText(line);
  if (!text || text.length > 32 || looksLikeIngredient(text)) {
    return false;
  }

  return /:\s*$/.test(line.trim()) || /^for the\b/i.test(text) || text.split(/\s+/).length <= 3;
}

function isNoise(line: string) {
  const text = stripEmoji(line);
  return !text || /^#/.test(text) || /^(#\S+\s*)+$/.test(text) || /^@\S+$/.test(text);
}

export type ParsedCaption = {
  title: string;
  ingredients: string[];
  method: string;
  links: string[];
};

function extractTitle(lines: string[]) {
  for (const line of lines) {
    if (isHeader(line, INGREDIENT_HEADER) || isHeader(line, METHOD_HEADER)) {
      // The title always comes before the recipe itself.
      break;
    }

    if (isNoise(line) || isBulleted(line)) {
      continue;
    }

    // Split on emoji and sentence ends so "Save this! My go-to breakfast 🍳"
    // and "No-bake cookies. Recipe in bio" give a clean title.
    const segments = line
      .replace(/https?:\/\/\S+/g, " ")
      .split(/(?<=[.!?])\s+|[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+/u)
      .map((segment) => stripEmoji(segment).replace(/^[\s\-–—|:,]+|[\s\-–—|:,]+$/g, "").trim())
      .filter((segment) => segment.length >= 3)
      .filter((segment) => !CTA_PATTERN.test(segment) && !/^#/.test(segment));

    let text = segments[0];
    if (!text) {
      continue;
    }

    if (text.length > 80) {
      text = `${text.slice(0, 77).replace(/\s+\S*$/, "")}...`;
    }

    return text.replace(/^["“'`]+|["”'`]+$/g, "").replace(/[.!]+$/, "").trim();
  }

  return "";
}

export function parseInstagramCaption(caption: string): ParsedCaption {
  const normalized = decodeHtml(caption).replace(/\r/g, "").trim();
  const links = [...normalized.matchAll(/https?:\/\/[^\s<>"')]+/g)]
    .map((match) => match[0].replace(/[.,;!]+$/, ""))
    .filter((link) => {
      try {
        return !isInstagramHost(new URL(link).hostname);
      } catch {
        return false;
      }
    });

  if (!normalized) {
    return { title: "", ingredients: [], method: "", links };
  }

  const lines = normalized.split("\n").map((line) => line.trim());
  const title = extractTitle(lines);

  const ingredientHeaderIndex = lines.findIndex((line) => isHeader(line, INGREDIENT_HEADER));
  const methodHeaderIndex = lines.findIndex(
    (line, index) => index > ingredientHeaderIndex && isHeader(line, METHOD_HEADER),
  );

  const ingredients: string[] = [];
  let methodStart = methodHeaderIndex >= 0 ? methodHeaderIndex + 1 : -1;

  if (ingredientHeaderIndex >= 0) {
    // Inline form: "Ingredients: 2 eggs, 1 cup flour, salt"
    const headerLine = lines[ingredientHeaderIndex];
    const inline = headerLine.replace(/^[^:]*:/, "").trim();
    if (headerLine.includes(":") && inline) {
      ingredients.push(
        ...inline
          .split(/,|;|•/)
          .map(cleanLine)
          .filter(Boolean),
      );
    }

    const end = methodHeaderIndex >= 0 ? methodHeaderIndex : lines.length;
    let sawIngredient = ingredients.length > 0;

    for (let index = ingredientHeaderIndex + 1; index < end; index += 1) {
      const line = lines[index];
      if (!line || isNoise(line)) {
        continue;
      }

      const text = cleanLine(line);
      if (!text) {
        continue;
      }

      if (isBulleted(line) || looksLikeIngredient(text)) {
        ingredients.push(stripEmoji(text) || text);
        sawIngredient = true;
        continue;
      }

      if (isSubheading(line)) {
        continue;
      }

      // A long prose paragraph after the list means the method has started,
      // even without a "Method" heading.
      if (sawIngredient && text.length > 60) {
        if (methodStart < 0) {
          methodStart = index;
        }
        break;
      }

      if (CTA_PATTERN.test(text)) {
        continue;
      }

      // Short unbulleted items such as "salt and pepper" inside the list.
      if (sawIngredient && text.length <= 60) {
        ingredients.push(stripEmoji(text) || text);
      }
    }
  } else {
    // No heading: fall back to lines that clearly look like ingredients.
    for (const line of lines) {
      const text = cleanLine(line);
      if (text && !isNoise(line) && looksLikeIngredient(text) && text.length <= 100) {
        ingredients.push(stripEmoji(text) || text);
      }
    }
  }

  let method = "";
  if (methodStart >= 0) {
    method = lines
      .slice(methodStart)
      .filter((line) => !isNoise(line))
      .filter((line) => !CTA_PATTERN.test(stripEmoji(line)))
      .map((line) => line.replace(/\s+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return {
    title,
    ingredients: [...new Set(ingredients)].slice(0, 60),
    method,
    links,
  };
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchText(url: string, userAgent: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      "accept-language": "en-US,en;q=0.9",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  return { html: await response.text(), finalUrl: response.url, ok: response.ok };
}

function htmlToText(fragment: string) {
  return decodeHtml(
    fragment
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type InstagramData = {
  caption: string;
  imageUrl: string;
  author: string;
  source: "embed" | "open_graph" | "none";
  loginWall: boolean;
  error?: string;
};

export function parseEmbedHtml(html: string) {
  const captionMatch = html.match(
    /<div class="Caption">([\s\S]*?)(?:<div class="CaptionComments"|<\/div>\s*<div class="Footer")/,
  );
  let author = "";
  let caption = "";

  if (captionMatch) {
    const fragment = captionMatch[1].replace(
      /<a[^>]*class="CaptionUsername"[^>]*>([\s\S]*?)<\/a>/,
      (_full, name: string) => {
        author = htmlToText(name);
        return "";
      },
    );
    caption = htmlToText(fragment);
  }

  const imageMatch =
    html.match(/<img[^>]*class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/) ??
    html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*EmbeddedMediaImage[^"]*"/);

  return {
    caption,
    author,
    imageUrl: imageMatch ? decodeHtml(imageMatch[1]) : "",
  };
}

function getMeta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content="([^"]*)"`, "i"),
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content='([^']*)'`, "i"),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)=["']${key}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return "";
}

export function parseOpenGraphCaption(description: string, title: string) {
  // og:description looks like: 12K likes, 80 comments - user on March 3, 2026: "caption..."
  const fromDescription = description.match(/:\s*["“]([\s\S]+)["”]\.?\s*$/);
  if (fromDescription) {
    return fromDescription[1];
  }

  // og:title looks like: Name on Instagram: "caption..."
  const fromTitle = title.match(/on Instagram:\s*["“]([\s\S]+)["”]\s*$/i);
  return fromTitle?.[1] ?? "";
}

export async function fetchInstagramData(info: ShortcodeInfo): Promise<InstagramData> {
  const errors: string[] = [];

  try {
    const embedUrl = `https://www.instagram.com/p/${info.shortcode}/embed/captioned/`;
    const { html } = await fetchText(embedUrl, BROWSER_USER_AGENT);
    const parsed = parseEmbedHtml(html);
    if (parsed.caption || parsed.imageUrl) {
      return { ...parsed, source: "embed", loginWall: false };
    }
    errors.push("embed page had no caption");
  } catch (error) {
    errors.push(`embed: ${error instanceof Error ? error.message : "request failed"}`);
  }

  try {
    const { html, finalUrl } = await fetchText(canonicalInstagramUrl(info), LINK_PREVIEW_USER_AGENT);
    const loginWall = /\/accounts\/login/.test(finalUrl);
    const ogTitle = getMeta(html, "og:title");
    const ogDescription = getMeta(html, "og:description");
    const ogImage = getMeta(html, "og:image");

    // The login wall serves generic "Instagram" tags and the Instagram logo.
    const isGeneric = loginWall || !ogTitle || /^instagram$/i.test(ogTitle.trim());
    if (!isGeneric) {
      return {
        caption: parseOpenGraphCaption(ogDescription, ogTitle),
        imageUrl: /static\.cdninstagram\.com\/rsrc/.test(ogImage) ? "" : ogImage,
        author: ogTitle.replace(/\s+on Instagram:[\s\S]*$/i, "").trim(),
        source: "open_graph",
        loginWall: false,
      };
    }

    return { caption: "", imageUrl: "", author: "", source: "none", loginWall, error: errors.join("; ") };
  } catch (error) {
    errors.push(`post page: ${error instanceof Error ? error.message : "request failed"}`);
    return { caption: "", imageUrl: "", author: "", source: "none", loginWall: false, error: errors.join("; ") };
  }
}

export async function resolveInstagramShortcode(url: URL): Promise<ShortcodeInfo | null> {
  const direct = parseInstagramShortcode(url);
  if (direct) {
    return direct;
  }

  // Share links (instagram.com/share/..., instagr.am/...) redirect to the post.
  try {
    const response = await fetch(url.toString(), {
      headers: { "user-agent": BROWSER_USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const fromRedirect = parseInstagramShortcode(response.url);
    if (fromRedirect) {
      return fromRedirect;
    }

    const nextParam = new URL(response.url).searchParams.get("next");
    return nextParam ? parseInstagramShortcode(new URL(nextParam, "https://www.instagram.com")) : null;
  } catch {
    return null;
  }
}
