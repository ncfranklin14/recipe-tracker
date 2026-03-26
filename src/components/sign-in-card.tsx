export function SignInCard() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="hero-panel w-full max-w-4xl rounded-[36px] p-6 text-white shadow-2xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <span className="badge">Kitchen Reel</span>
            <h1 className="max-w-xl font-serif text-5xl leading-none sm:text-6xl">
              Your private recipe shelf for links, Reel saves, and cooking notes.
            </h1>
            <p className="max-w-lg text-sm text-white/75 sm:text-base">
              Start simple: sign in, paste a link, clean up the import, and keep
              the recipes you actually want to cook again.
            </p>
          </div>

          <form action="/api/session" className="form-panel space-y-4 text-stone-900" method="post">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700" htmlFor="displayName">
                Display name
              </label>
              <input
                className="field"
                defaultValue="Nicole"
                id="displayName"
                name="displayName"
                placeholder="Your name"
                required
              />
            </div>
            <button className="primary-button w-full" type="submit">
              Enter my recipe library
            </button>
            <p className="text-xs text-stone-500">
              This starter uses a cookie-based single-user session so the app works
              locally right away. You can swap in Supabase auth next.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
