import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Instagram/Facebook CDN image links are signed and expire after a few days,
// so we keep a local copy of Reel cover images when a recipe is saved.
export const COVERS_DIR = path.join(process.cwd(), "data", "covers");

const EXPIRING_HOSTS = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function needsLocalCopy(imageUrl: string) {
  try {
    return EXPIRING_HOSTS.test(new URL(imageUrl).hostname);
  } catch {
    return false;
  }
}

export async function persistCoverImage(imageUrl: string) {
  if (!imageUrl || !needsLocalCopy(imageUrl)) {
    return imageUrl;
  }

  try {
    const response = await fetch(imageUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const extension = EXTENSIONS[contentType];
    if (!response.ok || !extension) {
      return imageUrl;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const fileName = `${randomUUID()}.${extension}`;
    await fs.mkdir(COVERS_DIR, { recursive: true });
    await fs.writeFile(path.join(COVERS_DIR, fileName), bytes);
    return `/api/covers/${fileName}`;
  } catch {
    return imageUrl;
  }
}
