import { promises as fs } from "fs";
import path from "path";
import { COVERS_DIR } from "@/lib/covers";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

type RouteProps = {
  params: Promise<{ file: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { file } = await params;
  const match = file.match(/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await fs.readFile(path.join(COVERS_DIR, file));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": CONTENT_TYPES[match[1]],
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
