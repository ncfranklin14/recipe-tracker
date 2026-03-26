type TagCreatorProps = {
  action: (formData: FormData) => Promise<void>;
};

export function TagCreator({ action }: TagCreatorProps) {
  return (
    <form action={action} className="form-panel space-y-4">
      <div className="space-y-1">
        <span className="badge badge-soft">Tags</span>
        <h2 className="font-serif text-2xl text-stone-900">Save the useful shorthand</h2>
      </div>
      <input className="field" name="name" placeholder="quick, cozy, date night..." required />
      <button className="secondary-button w-full" type="submit">
        Add tag
      </button>
    </form>
  );
}
