import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { buildImportPreview } from "@/lib/importer";

export async function POST(request: Request) {
  await requireSession();
  const { url } = (await request.json()) as { url?: string };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const preview = await buildImportPreview(url);
  return NextResponse.json(preview);
}
