import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createCollection } from "@/lib/store";

export async function POST(request: Request) {
  await requireSession();
  const { name } = (await request.json()) as { name?: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const collection = await createCollection(name);
  return NextResponse.json(collection, { status: 201 });
}
