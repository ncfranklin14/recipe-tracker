import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaptureForm } from "@/components/capture-form";
import { CollectionCreator } from "@/components/collection-creator";
import { FilterBar } from "@/components/filter-bar";
import { SignInCard } from "@/components/sign-in-card";
import { TagCreator } from "@/components/tag-creator";
import { createCollection, createTag, listCollections, listRecipes, listTags } from "@/lib/store";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const session = (await cookies()).get("kitchen-session");

  if (!session) {
    return <SignInCard />;
  }

  const params = (await searchParams) ?? {};
  const query = pickParam(params.q) ?? "";
  const collectionId = pickParam(params.collection) ?? "";
  const tagId = pickParam(params.tag) ?? "";
  const sort =
    pickParam(params.sort) === "saved" ? "saved" : "updated";

  const [recipes, collections, tags] = await Promise.all([
    listRecipes({ query, collectionId, tagId, sort }),
    listCollections(),
    listTags(),
  ]);

  async function handleSignOut() {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("kitchen-session");
    redirect("/");
  }

  async function handleCreateCollection(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return;
    }

    await createCollection(name);
    redirect("/");
  }

  async function handleCreateTag(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return;
    }

    await createTag(name);
    redirect("/");
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="hero-panel overflow-hidden rounded-[32px] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="badge">Private recipe vault</span>
              <div className="space-y-3">
                <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl">
                  Save recipes from websites and Instagram Reels without losing the good ones.
                </h1>
                <p className="max-w-xl text-sm text-white/75 sm:text-base">
                  Paste a link, clean it up once, and keep a library you can
                  search by ingredient, mood, collection, or tag.
                </p>
              </div>
            </div>

            <form action={handleSignOut}>
              <button className="ghost-button" type="submit">
                Sign out
              </button>
            </form>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
            <CaptureForm />
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <article className="stat-card">
                <span className="stat-label">Recipes saved</span>
                <strong className="stat-value">{recipes.length}</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Collections</span>
                <strong className="stat-value">{collections.length}</strong>
              </article>
              <article className="stat-card">
                <span className="stat-label">Tags</span>
                <strong className="stat-value">{tags.length}</strong>
              </article>
            </div>
          </div>
        </section>

        <FilterBar
          collections={collections}
          currentCollection={collectionId}
          currentQuery={query}
          currentSort={sort}
          currentTag={tagId}
          tags={tags}
        />

        <section className="grid gap-6 lg:grid-cols-[0.7fr_0.3fr]">
          <div className="space-y-4">
            {recipes.length === 0 ? (
              <article className="empty-state">
                <span className="badge badge-soft">Nothing here yet</span>
                <h2 className="font-serif text-3xl text-stone-900">
                  Start with a link you already love.
                </h2>
                <p className="max-w-lg text-sm text-stone-600">
                  Recipe websites auto-fill when possible. Reels save with notes,
                  tags, and manual ingredient edits so you never lose the
                  details.
                </p>
              </article>
            ) : (
              recipes.map((recipe) => (
                <article className="recipe-card" key={recipe.id}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <a
                      className="cover-shell block transition-transform duration-150 hover:-translate-y-0.5"
                      href={recipe.sourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {recipe.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={recipe.title}
                          className="cover-image"
                          src={recipe.coverImageUrl}
                        />
                      ) : (
                        <div className="cover-placeholder">
                          {recipe.sourceType === "instagram_reel" ? "Reel" : "Web"}
                        </div>
                      )}
                    </a>

                    <Link className="flex-1 space-y-3" href={`/recipes/${recipe.id}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-soft">
                          {recipe.sourceType === "instagram_reel"
                            ? "Instagram Reel"
                            : recipe.sourceDomain || "Website"}
                        </span>
                        <span className="badge badge-soft">
                          {recipe.status === "saved" ? "Saved" : "Draft"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h2 className="line-clamp-4 font-serif text-2xl text-stone-900">
                          {recipe.title}
                        </h2>
                        <p className="line-clamp-3 text-sm text-stone-600">
                          {recipe.summary || recipe.notes || "Open to add details."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {recipe.collectionIds
                          .map((id) => collections.find((item) => item.id === id))
                          .filter(Boolean)
                          .map((collection) => (
                            <span className="chip" key={collection?.id}>
                              {collection?.name}
                            </span>
                          ))}
                        {recipe.tagIds
                          .map((id) => tags.find((item) => item.id === id))
                          .filter(Boolean)
                          .map((tag) => (
                            <span className="chip chip-muted" key={tag?.id}>
                              #{tag?.name}
                            </span>
                          ))}
                      </div>
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="space-y-4">
            <CollectionCreator action={handleCreateCollection} />
            <TagCreator action={handleCreateTag} />
          </aside>
        </section>
      </div>
    </main>
  );
}
