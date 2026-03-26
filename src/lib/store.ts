import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  Collection,
  Recipe,
  RecipeFilters,
  RecipeInput,
  SortMode,
  StoreShape,
  Tag,
} from "@/lib/types";

const DATA_FILE = path.join(process.cwd(), "data", "store.json");
const OWNER_ID = "local-user";

const seedStore: StoreShape = {
  collections: [
    { id: randomUUID(), name: "Dinner", createdAt: new Date().toISOString() },
    { id: randomUUID(), name: "Desserts", createdAt: new Date().toISOString() },
    { id: randomUUID(), name: "Meal Prep", createdAt: new Date().toISOString() },
  ],
  tags: [
    { id: randomUUID(), name: "quick", createdAt: new Date().toISOString() },
    { id: randomUUID(), name: "spicy", createdAt: new Date().toISOString() },
    { id: randomUUID(), name: "vegetarian", createdAt: new Date().toISOString() },
  ],
  recipes: [],
};

function cleanInstagramStoredTitle(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#xbd;/g, "1/2")
    .replace(/&#x2013;/gi, "-")
    .replace(/&#x1f[0-9a-f]+;/gi, "")
    .replace(/^[^:]+ on Instagram:\s*/i, "")
    .replace(/\bingredients?\b[\s\S]*$/i, "")
    .replace(/\bmethod\b[\s\S]*$/i, "")
    .replace(/\binstructions?\b[\s\S]*$/i, "")
    .replace(/\s*[|•]\s*[\s\S]*$/i, "")
    .replace(/^["“'`]+|["”'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRecipe(recipe: Recipe) {
  if (recipe.sourceType !== "instagram_reel") {
    return recipe;
  }

  return {
    ...recipe,
    title: cleanInstagramStoredTitle(recipe.title) || "Saved Instagram Reel",
    summary: "",
    ingredients: [],
  };
}

async function ensureStoreFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(seedStore, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStoreFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw) as StoreShape;
  const normalized: StoreShape = {
    ...parsed,
    recipes: parsed.recipes.map(normalizeRecipe),
  };

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await writeStore(normalized);
  }

  return normalized;
}

async function writeStore(store: StoreShape) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function matches(recipe: Recipe, filters: RecipeFilters) {
  const query = filters.query?.trim().toLowerCase();
  const searchHaystack = [
    recipe.title,
    recipe.summary,
    recipe.notes,
    ...recipe.ingredients,
  ]
    .join(" ")
    .toLowerCase();

  if (query && !searchHaystack.includes(query)) {
    return false;
  }

  if (filters.collectionId && !recipe.collectionIds.includes(filters.collectionId)) {
    return false;
  }

  if (filters.tagId && !recipe.tagIds.includes(filters.tagId)) {
    return false;
  }

  return true;
}

function sortRecipes(recipes: Recipe[], sort: SortMode) {
  return [...recipes].sort((left, right) => {
    const leftDate = sort === "saved" ? left.createdAt : left.updatedAt;
    const rightDate = sort === "saved" ? right.createdAt : right.updatedAt;

    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });
}

export async function listRecipes(filters: RecipeFilters = {}) {
  const store = await readStore();
  const scoped = store.recipes.filter((recipe) => recipe.ownerId === OWNER_ID);
  return sortRecipes(scoped.filter((recipe) => matches(recipe, filters)), filters.sort ?? "updated");
}

export async function getRecipe(id: string) {
  const store = await readStore();
  return (
    store.recipes.find((recipe) => recipe.ownerId === OWNER_ID && recipe.id === id) ??
    null
  );
}

export async function createRecipe(input: RecipeInput) {
  const store = await readStore();
  const now = new Date().toISOString();

  const recipe: Recipe = {
    id: randomUUID(),
    ownerId: OWNER_ID,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    sourceDomain: input.sourceDomain,
    title: input.title,
    coverImageUrl: input.coverImageUrl,
    summary: input.summary,
    ingredients: input.ingredients,
    notes: input.notes,
    collectionIds: input.collectionIds,
    tagIds: input.tagIds,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    importMeta: input.importMeta,
  };

  store.recipes.unshift(recipe);
  await writeStore(store);
  return recipe;
}

export async function updateRecipe(id: string, input: Partial<RecipeInput>) {
  const store = await readStore();
  const index = store.recipes.findIndex(
    (recipe) => recipe.ownerId === OWNER_ID && recipe.id === id,
  );

  if (index === -1) {
    return null;
  }

  const current = store.recipes[index];
  const updated: Recipe = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
    ingredients: input.ingredients ?? current.ingredients,
    collectionIds: input.collectionIds ?? current.collectionIds,
    tagIds: input.tagIds ?? current.tagIds,
    importMeta: input.importMeta ?? current.importMeta,
  };

  store.recipes[index] = updated;
  await writeStore(store);
  return updated;
}

export async function deleteRecipe(id: string) {
  const store = await readStore();
  const index = store.recipes.findIndex(
    (recipe) => recipe.ownerId === OWNER_ID && recipe.id === id,
  );

  if (index === -1) {
    return false;
  }

  store.recipes.splice(index, 1);
  await writeStore(store);
  return true;
}

export async function duplicateRecipe(id: string) {
  const recipe = await getRecipe(id);
  if (!recipe) {
    return null;
  }

  return createRecipe({
    ...recipe,
    title: `${recipe.title} (Variation)`,
    status: "draft",
    importMeta: {
      ...recipe.importMeta,
      lastImportAttemptAt: new Date().toISOString(),
    },
  });
}

export async function listCollections() {
  const store = await readStore();
  return store.collections;
}

export async function createCollection(name: string) {
  const store = await readStore();
  const normalized = name.trim();
  const existing = store.collections.find(
    (collection) => collection.name.toLowerCase() === normalized.toLowerCase(),
  );

  if (existing) {
    return existing;
  }

  const collection: Collection = {
    id: randomUUID(),
    name: normalized,
    createdAt: new Date().toISOString(),
  };

  store.collections.unshift(collection);
  await writeStore(store);
  return collection;
}

export async function listTags() {
  const store = await readStore();
  return store.tags;
}

export async function createTag(name: string) {
  const store = await readStore();
  const normalized = name.trim().replace(/^#/, "");
  const existing = store.tags.find(
    (tag) => tag.name.toLowerCase() === normalized.toLowerCase(),
  );

  if (existing) {
    return existing;
  }

  const tag: Tag = {
    id: randomUUID(),
    name: normalized,
    createdAt: new Date().toISOString(),
  };

  store.tags.unshift(tag);
  await writeStore(store);
  return tag;
}
