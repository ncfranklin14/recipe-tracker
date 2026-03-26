import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { duplicateRecipe } from "@/lib/store";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  await requireSession();
  const { id } = await params;
  const recipe = await duplicateRecipe(id);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(recipe, { status: 201 });
}
