import { buildImportPreview, buildInstagramPreviewFromCaption, sourceTypeForUrl } from "@/lib/importer";
import { canonicalInstagramUrl, parseInstagramShortcode } from "@/lib/instagram";
import { CapturePayload, ImportPreview, SourceType } from "@/lib/types";

function makeFallbackTitle(url: URL) {
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

function titleFromInstagramPageTitle(value: string) {
  // document.title on Instagram is like: 'Name on Instagram: "Steak Ramen 🍜 ..."'
  const quoted = value.match(/on Instagram:\s*["“]([\s\S]+?)["”]/i);
  return quoted?.[1] ?? "";
}

export function decodeCapturePayload(value: string): CapturePayload | null {
  try {
    const decoded = Buffer.from(decodeURIComponent(value), "base64url").toString("utf8");
    return JSON.parse(decoded) as CapturePayload;
  } catch {
    return null;
  }
}

export async function buildImportPreviewFromCapture(payload: CapturePayload): Promise<ImportPreview> {
  let url: URL;
  try {
    url = new URL(payload.sourceUrl);
  } catch {
    return buildImportPreview(payload.sourceUrl ?? "");
  }

  const sourceType: SourceType = payload.sourceType ?? sourceTypeForUrl(url);

  if (sourceType === "instagram_reel") {
    // Prefer a fresh server-side import (clean caption from the embed page).
    // Fall back to the text the extension captured from the open tab.
    const serverPreview = await buildImportPreview(payload.sourceUrl);
    if (serverPreview.importMeta.status === "success" || !payload.captionText) {
      return {
        ...serverPreview,
        coverImageUrl: serverPreview.coverImageUrl || payload.imageUrl?.trim() || "",
      };
    }

    const info = parseInstagramShortcode(url);
    return buildInstagramPreviewFromCaption(info ? canonicalInstagramUrl(info) : payload.sourceUrl, {
      caption: payload.captionText,
      imageUrl: serverPreview.coverImageUrl || payload.imageUrl?.trim() || "",
      fallbackTitle: titleFromInstagramPageTitle(payload.pageTitle ?? "") || undefined,
      source: "browser_extension",
    });
  }

  if (!payload.selectionText && !payload.pageTitle) {
    return buildImportPreview(payload.sourceUrl);
  }

  // Web pages: the server import usually gets structured data; keep the
  // extension's title/selection as a fallback.
  const serverPreview = await buildImportPreview(payload.sourceUrl);
  if (serverPreview.importMeta.status === "success") {
    return serverPreview;
  }

  return {
    ...serverPreview,
    title: payload.pageTitle?.trim() || serverPreview.title || makeFallbackTitle(url),
    coverImageUrl: serverPreview.coverImageUrl || payload.imageUrl?.trim() || "",
    summary: serverPreview.summary || (payload.selectionText ?? "").trim().slice(0, 280),
  };
}
