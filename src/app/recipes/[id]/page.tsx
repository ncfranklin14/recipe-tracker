import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RecipeEditor } from "@/components/recipe-editor";
import { getRecipe, listCollections, listTags } from "@/lib/store";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RecipePage({ params }: RecipePageProps) {
  const session = (await cookies()).get("kitchen-session");
  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const [recipe, collections, tags] = await Promise.all([
    getRecipe(id),
    listCollections(),
    listTags(),
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <RecipeEditor collections={collections} recipe={recipe} tags={tags} />
      </div>
    </main>
  );
}
