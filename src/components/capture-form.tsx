export function CaptureForm() {
  return (
    <form action="/import" className="panel space-y-4" method="get">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-stone-700" htmlFor="url">
          Paste a recipe or Reel link
        </label>
        <input
          className="field"
          id="url"
          name="url"
          placeholder="https://..."
          required
          type="url"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-600">
          Recipe sites and Reel captions auto-extract when possible. You can
          review and edit everything before saving.
        </p>
        <button className="primary-button" type="submit">
          Review import
        </button>
      </div>
    </form>
  );
}
