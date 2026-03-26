import { buildImportPreview } from "@/lib/importer";
import { CapturePayload, ImportPreview, SourceType } from "@/lib/types";

function makeImportMeta(parserResult: Record<string, unknown>, status: "success" | "partial" | "failed", confidence: "high" | "medium" | "low") {
  return {
    rawContent: null,
    parserResult,
    confidence,
    status,
    lastImportAttemptAt: new Date().toISOString(),
  };
}

function cleanInstagramTitle(value: string) {
  const decoded = value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
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

export function decodeCapturePayload(value: string): CapturePayload | null {
  try {
    const decoded = Buffer.from(decodeURIComponent(value), "base64url").toString("utf8");
    return JSON.parse(decoded) as CapturePayload;
  } catch {
    return null;
  }
}

export async function buildImportPreviewFromCapture(payload: CapturePayload): Promise<ImportPreview> {
  if (!payload.captionText && !payload.pageTitle && payload.sourceUrl) {
    return buildImportPreview(payload.sourceUrl);
  }

  const url = new URL(payload.sourceUrl);
  const sourceType: SourceType =
    payload.sourceType ?? (/instagram\.com$/.test(url.hostname.replace(/^www\./, "")) ? "instagram_reel" : "web");
  const sourceDomain = url.hostname.replace(/^www\./, "");
  const title =
    sourceType === "instagram_reel"
      ? cleanInstagramTitle(payload.pageTitle ?? "") || makeFallbackTitle(url, sourceType)
      : (payload.pageTitle?.trim() || makeFallbackTitle(url, sourceType));
  const ingredients: string[] = [];
  const summary =
    sourceType === "instagram_reel"
      ? ""
      : (payload.selectionText ?? "").trim().slice(0, 280);
  const status =
    title !== "Saved Instagram Reel" || ingredients.length > 0 || Boolean(payload.imageUrl)
      ? "partial"
      : "failed";

  return {
    sourceType,
    sourceUrl: payload.sourceUrl,
    sourceDomain,
    title,
    coverImageUrl: payload.imageUrl?.trim() ?? "",
    summary,
    ingredients,
    notes: "",
    importMeta: makeImportMeta(
      {
        source: "browser_extension",
        capturedTitle: payload.pageTitle ?? null,
        capturedCaption: Boolean(payload.captionText),
      },
      status,
      status === "failed" ? "low" : "medium",
    ),
  };
}
