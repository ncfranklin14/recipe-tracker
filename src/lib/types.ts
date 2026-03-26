export type SourceType = "web" | "instagram_reel";
export type RecipeStatus = "draft" | "saved";
export type SortMode = "updated" | "saved";

export type Collection = {
  id: string;
  name: string;
  createdAt: string;
};

export type Tag = {
  id: string;
  name: string;
  createdAt: string;
};

export type ImportMeta = {
  rawContent: string | null;
  parserResult: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  status: "success" | "partial" | "failed";
  lastImportAttemptAt: string;
};

export type CapturePayload = {
  sourceUrl: string;
  sourceType?: SourceType;
  pageTitle?: string;
  imageUrl?: string;
  captionText?: string;
  selectionText?: string;
};

export type Recipe = {
  id: string;
  ownerId: string;
  sourceType: SourceType;
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  coverImageUrl: string;
  summary: string;
  ingredients: string[];
  notes: string;
  collectionIds: string[];
  tagIds: string[];
  status: RecipeStatus;
  createdAt: string;
  updatedAt: string;
  importMeta: ImportMeta;
};

export type ImportPreview = {
  sourceType: SourceType;
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  coverImageUrl: string;
  summary: string;
  ingredients: string[];
  notes: string;
  importMeta: ImportMeta;
};

export type StoreShape = {
  collections: Collection[];
  tags: Tag[];
  recipes: Recipe[];
};

export type RecipeInput = {
  sourceType: SourceType;
  sourceUrl: string;
  sourceDomain: string;
  title: string;
  coverImageUrl: string;
  summary: string;
  ingredients: string[];
  notes: string;
  collectionIds: string[];
  tagIds: string[];
  status: RecipeStatus;
  importMeta: ImportMeta;
};

export type RecipeFilters = {
  query?: string;
  collectionId?: string;
  tagId?: string;
  sort?: SortMode;
};
