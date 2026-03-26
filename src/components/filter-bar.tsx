import { Collection, Tag } from "@/lib/types";

type FilterBarProps = {
  collections: Collection[];
  currentCollection: string;
  currentQuery: string;
  currentSort: "updated" | "saved";
  currentTag: string;
  tags: Tag[];
};

export function FilterBar({
  collections,
  currentCollection,
  currentQuery,
  currentSort,
  currentTag,
  tags,
}: FilterBarProps) {
  return (
    <form className="panel filter-grid" method="get">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-700" htmlFor="q">
          Search
        </label>
        <input
          className="field"
          defaultValue={currentQuery}
          id="q"
          name="q"
          placeholder="Search title, notes, ingredients..."
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-700" htmlFor="collection">
          Collection
        </label>
        <select className="select" defaultValue={currentCollection} id="collection" name="collection">
          <option value="">All collections</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-700" htmlFor="tag">
          Tag
        </label>
        <select className="select" defaultValue={currentTag} id="tag" name="tag">
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              #{tag.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-700" htmlFor="sort">
          Sort
        </label>
        <div className="flex gap-2">
          <select className="select" defaultValue={currentSort} id="sort" name="sort">
            <option value="updated">Newest updated</option>
            <option value="saved">Newest saved</option>
          </select>
          <button className="secondary-button" type="submit">
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}
