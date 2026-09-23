"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { arrayToLines, linesToArray } from "@/lib/formats";
import { Collection, Recipe, Tag } from "@/lib/types";

type RecipeEditorProps = {
  collections: Collection[];
  recipe: Recipe;
  tags: Tag[];
};

export function RecipeEditor({ collections, recipe, tags }: RecipeEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: recipe.title,
    coverImageUrl: recipe.coverImageUrl,
    summary: recipe.summary,
    ingredients: arrayToLines(recipe.ingredients),
    notes: recipe.notes,
    collectionIds: recipe.collectionIds,
    tagIds: recipe.tagIds,
    status: recipe.status,
  });
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        ingredients: linesToArray(form.ingredients),
      }),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleDuplicate() {
    setDuplicating(true);
    const response = await fetch(`/api/recipes/${recipe.id}/duplicate`, {
      method: "POST",
    });
    const duplicated = await response.json();
    router.push(`/recipes/${duplicated.id}`);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete "${recipe.title}"? This can't be undone.`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    await fetch(`/api/recipes/${recipe.id}`, {
      method: "DELETE",
    });
    router.push("/");
    router.refresh();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.36fr_0.64fr]">
      <aside className="form-panel space-y-4">
        <div className="space-y-2">
          <span className="badge badge-soft">
            {recipe.sourceType === "instagram_reel" ? "Instagram Reel" : recipe.sourceDomain}
          </span>
          <h1 className="font-serif text-4xl text-stone-900">{recipe.title}</h1>
          <p className="text-sm text-stone-600">
            Imported on {new Date(recipe.createdAt).toLocaleDateString()} and last edited on{" "}
            {new Date(recipe.updatedAt).toLocaleDateString()}.
          </p>
        </div>

        <div className="space-y-3 rounded-[24px] border border-[var(--border)] bg-white/55 p-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Source URL
            </span>
            <p className="mt-1 break-all text-sm text-stone-700">{recipe.sourceUrl}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Import status
            </span>
            <p className="mt-1 text-sm text-stone-700">{recipe.importMeta.status}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Parser confidence
            </span>
            <p className="mt-1 text-sm text-stone-700">{recipe.importMeta.confidence}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button className="secondary-button" onClick={() => router.push("/")} type="button">
            Back to library
          </button>
          <button className="secondary-button" disabled={duplicating} onClick={handleDuplicate} type="button">
            {duplicating ? "Duplicating..." : "Duplicate as variation"}
          </button>
          <button className="secondary-button" disabled={deleting} onClick={handleDelete} type="button">
            {deleting ? "Deleting..." : "Delete recipe"}
          </button>
        </div>
      </aside>

      <div className="form-panel space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Title</label>
            <input
              className="field"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              value={form.title}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Cover image URL</label>
            <input
              className="field"
              onChange={(event) =>
                setForm((current) => ({ ...current, coverImageUrl: event.target.value }))
              }
              value={form.coverImageUrl}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-stone-700">
            {recipe.sourceType === "instagram_reel" ? "Method / caption notes" : "Summary"}
          </label>
          <textarea
            className="textarea"
            onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
            value={form.summary}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-stone-700">Ingredients</label>
          <textarea
            className="textarea"
            onChange={(event) =>
              setForm((current) => ({ ...current, ingredients: event.target.value }))
            }
            value={form.ingredients}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-stone-700">Notes</label>
          <textarea
            className="textarea"
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            value={form.notes}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Collections</label>
            <select
              className="select min-h-[148px]"
              multiple
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  collectionIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                }))
              }
              value={form.collectionIds}
            >
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Tags</label>
            <select
              className="select min-h-[148px]"
              multiple
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tagIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                }))
              }
              value={form.tagIds}
            >
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Status</label>
            <select
              className="select"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as "draft" | "saved",
                }))
              }
              value={form.status}
            >
              <option value="saved">Saved</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="primary-button" disabled={saving} onClick={handleSave} type="button">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
