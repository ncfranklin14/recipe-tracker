"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { arrayToLines, linesToArray } from "@/lib/formats";
import { Collection, ImportPreview, Tag } from "@/lib/types";

type ImportReviewFormProps = {
  collections: Collection[];
  preview: ImportPreview;
  tags: Tag[];
};

export function ImportReviewForm({
  collections,
  preview,
  tags,
}: ImportReviewFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(preview.title);
  const [summary, setSummary] = useState(preview.summary);
  const [coverImageUrl, setCoverImageUrl] = useState(preview.coverImageUrl);
  const [ingredients, setIngredients] = useState(arrayToLines(preview.ingredients));
  const [notes, setNotes] = useState(preview.notes);
  const [selectedCollections, setSelectedCollections] = useState(preview.sourceType === "web" ? collections.slice(0, 1).map((item) => item.id) : []);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "saved">("saved");
  const [saving, setSaving] = useState(false);

  const importStatusLabel = useMemo(() => {
    if (preview.importMeta.status === "success") {
      return "Imported cleanly";
    }
    if (preview.importMeta.status === "partial") {
      return "Imported with some gaps";
    }
    return "Manual cleanup needed";
  }, [preview.importMeta.status]);

  async function handleSave() {
    setSaving(true);

    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...preview,
        title,
        summary,
        coverImageUrl,
        ingredients: linesToArray(ingredients),
        notes,
        collectionIds: selectedCollections,
        tagIds: selectedTags,
        status,
      }),
    });

    const recipe = await response.json();
    router.push(`/recipes/${recipe.id}`);
    router.refresh();
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.38fr_0.62fr]">
      <aside className="form-panel space-y-4">
        <span className="badge badge-soft">{importStatusLabel}</span>
        <div className="space-y-2">
          <h2 className="font-serif text-3xl text-stone-900">Import review</h2>
          <p className="text-sm text-stone-600">
            Clean up the fields once, then save your own editable copy.
          </p>
        </div>

        <div className="space-y-3 rounded-[24px] border border-[var(--border)] bg-white/55 p-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Source
            </span>
            <p className="mt-1 text-sm text-stone-700">{preview.sourceUrl}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Parser confidence
            </span>
            <p className="mt-1 text-sm text-stone-700">{preview.importMeta.confidence}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Suggested workflow
            </span>
            <p className="mt-1 text-sm text-stone-700">
              {preview.sourceType === "instagram_reel"
                ? "Keep the Reel link, image, and title here. Open the Reel on Instagram whenever you want the full details."
                : "Review the imported text and trim anything that looks noisy before saving."}
            </p>
          </div>
        </div>
      </aside>

      <div className="form-panel space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Title</label>
            <input className="field" onChange={(event) => setTitle(event.target.value)} value={title} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Cover image URL</label>
            <input
              className="field"
              onChange={(event) => setCoverImageUrl(event.target.value)}
              value={coverImageUrl}
            />
          </div>
        </div>

        {preview.sourceType === "web" ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Summary</label>
            <textarea className="textarea" onChange={(event) => setSummary(event.target.value)} value={summary} />
          </div>
        ) : null}

        {preview.sourceType === "web" ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Ingredients</label>
            <textarea
              className="textarea"
              onChange={(event) => setIngredients(event.target.value)}
              placeholder="One ingredient per line"
              value={ingredients}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-semibold text-stone-700">Notes</label>
          <textarea
            className="textarea"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Why you saved it, substitutions, serving ideas..."
            value={notes}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Collections</label>
            <select
              className="select min-h-[148px]"
              multiple
              onChange={(event) =>
                setSelectedCollections(Array.from(event.target.selectedOptions).map((option) => option.value))
              }
              value={selectedCollections}
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
                setSelectedTags(Array.from(event.target.selectedOptions).map((option) => option.value))
              }
              value={selectedTags}
            >
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-stone-700">Save as</label>
            <select
              className="select"
              onChange={(event) => setStatus(event.target.value as "draft" | "saved")}
              value={status}
            >
              <option value="saved">Saved recipe</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button className="secondary-button" onClick={() => router.push("/")} type="button">
            Back to library
          </button>
          <button className="primary-button" disabled={saving} onClick={handleSave} type="button">
            {saving ? "Saving..." : "Save recipe"}
          </button>
        </div>
      </div>
    </section>
  );
}
