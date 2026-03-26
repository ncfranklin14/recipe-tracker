import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createTag } from "@/lib/store";

export async function POST(request: Request) {
  await requireSession();
  const { name } = (await request.json()) as { name?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const tag = await createTag(name);
  return NextResponse.json(tag, { status: 201 });
}
