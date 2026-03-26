type CollectionCreatorProps = {
  action: (formData: FormData) => Promise<void>;
};

export function CollectionCreator({ action }: CollectionCreatorProps) {
  return (
    <form action={action} className="form-panel space-y-4">
      <div className="space-y-1">
        <span className="badge badge-soft">Collections</span>
        <h2 className="font-serif text-2xl text-stone-900">Make browseable shelves</h2>
      </div>
      <input className="field" name="name" placeholder="Dinner, Baking, Party food..." required />
      <button className="secondary-button w-full" type="submit">
        Add collection
      </button>
    </form>
  );
}
