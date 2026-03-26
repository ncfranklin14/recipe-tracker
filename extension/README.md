# Kitchen Reel Browser Extension Scaffold

This is a starter Chrome extension that captures the current page and opens the Kitchen Reel import flow with prefilled data.

## What it captures

- current URL
- page title
- Open Graph image
- visible page text
- Instagram page text as a fallback capture source for future improvements

## How to test

1. Start the app with `npm run dev`
2. Open `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the [`extension`](/Users/nicole/Documents/New%20project/extension) folder
6. Edit `APP_ORIGIN` in [`background.js`](/Users/nicole/Documents/New%20project/extension/background.js) if your app is not running on `http://localhost:3000`
7. Visit a recipe page or Instagram Reel/post
8. Click the extension icon

The extension opens Kitchen Reel's existing `/import` page with a captured payload.

## Current limitations

- This is a scaffold, not a production-hardened extension
- Instagram DOM scraping is brittle and may need selector tuning
- Large captions may exceed URL size limits because the scaffold passes data through the query string
- The long-term production version should POST captured data to the app and redirect with a short capture ID instead

## Recommended next step

Replace query-string transport with:

- `POST /api/capture`
- temporary capture storage keyed by ID
- `/import?captureId=...`
