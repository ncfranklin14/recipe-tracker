import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteRecipe, updateRecipe } from "@/lib/store";
import { RecipeInput } from "@/lib/types";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  await requireSession();
  const body = (await request.json()) as Partial<RecipeInput>;
  const { id } = await params;
  const recipe = await updateRecipe(id, body);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function DELETE(_: Request, { params }: RouteProps) {
  await requireSession();
  const { id } = await params;
  const deleted = await deleteRecipe(id);

  if (!deleted) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
