# Kitchen Reel

Kitchen Reel is a mobile-first recipe app for saving recipes you find on the web and recipes you discover in Instagram Reels. Paste a link, review the import, and save an editable copy with collections, tags, notes, and ingredients.

## What is implemented

- Private single-user entry flow with a cookie-based local session
- Library screen with:
  - link capture
  - search
  - filter by collection
  - filter by tag
  - sort by newest updated or newest saved
- Import review flow for:
  - standard recipe URLs with schema.org and Open Graph parsing
  - Instagram Reel URLs with partial metadata plus manual cleanup
- Full recipe editing screen
- Duplicate-as-variation flow
- API routes for import, recipes, collections, tags, and session handling
- Local JSON persistence in [`data/store.json`](/Users/nicole/Documents/New%20project/data/store.json)

## Stack

- Next.js App Router
- React
- Tailwind CSS
- File-backed JSON storage for local development

The UI and API are structured so you can swap the storage/auth layer to Supabase later without redesigning the app.

## Browser extension scaffold

There is also a starter browser extension scaffold in [`extension`](/Users/nicole/Documents/New%20project/extension) for a future "Save to Kitchen Reel" flow. The app can now accept captured page data on the `/import` route and prefill Instagram title/image/ingredient extraction from extension-provided content.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build and verify

```bash
npm run build
npm run lint
npx tsc --noEmit
```

## Current storage/auth behavior

- Recipes, collections, and tags are stored in `data/store.json`
- The current auth flow is intentionally lightweight so the app works immediately in a fresh local repo
- API routes require the session cookie set by the sign-in form

## Next recommended upgrade

To align fully with the original product plan, the next implementation step is replacing the local file store and cookie session with:

- Supabase Auth for sign-in
- Supabase Postgres tables for recipes, import metadata, tags, and collections
- Row-level security scoped by owner user ID
