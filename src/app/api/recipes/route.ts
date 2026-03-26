import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createRecipe, listRecipes } from "@/lib/store";
import { RecipeInput } from "@/lib/types";

export async function GET(request: Request) {
  await requireSession();
  const { searchParams } = new URL(request.url);

  const recipes = await listRecipes({
    query: searchParams.get("q") ?? "",
    collectionId: searchParams.get("collection") ?? "",
    tagId: searchParams.get("tag") ?? "",
    sort: searchParams.get("sort") === "saved" ? "saved" : "updated",
  });

  return NextResponse.json(recipes);
}

export async function POST(request: Request) {
  await requireSession();
  const body = (await request.json()) as RecipeInput & {
    collectionIds: string[];
    tagIds: string[];
  };

  const recipe = await createRecipe({
    ...body,
    ingredients: body.ingredients ?? [],
    notes: body.notes ?? "",
    collectionIds: body.collectionIds ?? [],
    tagIds: body.tagIds ?? [],
  });

  return NextResponse.json(recipe, { status: 201 });
}
