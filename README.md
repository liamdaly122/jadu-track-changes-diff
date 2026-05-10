# Jadu Track Changes Diff

A static browser-only tool that compares the old and new versions of a University of Leeds Jadu CMS "Track Changes" page and shows a clean side-by-side diff with paragraph-level highlighting.

Everything runs in your browser. The HTML you paste never leaves your machine.

## Usage

1. Open the app in your browser (`npm run dev` then visit the printed URL).
2. In Jadu, view a Track Changes page. Right-click → "View Page Source" (or press Ctrl/Cmd+U), select all, copy.
3. Paste into the textarea and click **Compare**.
4. The two panes show old (left) and new (right) with each paragraph colour-coded:
   - Green: added (new only)
   - Red: removed (old only)
   - Amber: modified (similar paragraphs paired)
   - No colour: unchanged
5. Toggles:
   - **Highlight differences** — turn off to read the content without colour highlighting
   - **Show rendered HTML** — when on, each pane is an iframe styled with the public Leeds design-system CSS so the content looks close to the published page. Requires internet access to fetch the Leeds stylesheets from `jaducdn.leeds.ac.uk` and the typekit fonts. The HTML you paste still stays on your machine — only the stylesheets are downloaded. Turn off for a no-network plain-text view.
   - **Show word-level changes in modified paragraphs** — off by default. When on, modified paragraphs are shown as plain text with green-highlighted added words and red strikethrough removed words. Useful for spotting small edits in long paragraphs. While this is on, modified blocks lose their original formatting (links, bold, etc.) — turn it off to get formatting back. Added/removed/unchanged blocks are unaffected.
6. Click **Save this comparison** to keep it in browser local storage. Saved comparisons appear in the sidebar (newest first, capped at 20). Click one to reload it; click the × to delete.

## Run locally

```
npm install
npm run dev
```

Then open the URL printed in the terminal (usually http://localhost:5173).

## Build for production

```
npm run build
```

Output goes to `dist/`. Open `dist/index.html` directly or serve it with any static file server.

## Tests

```
npm test           # run once and exit
npm run test:watch # re-run on save
npm run test:ui    # open the test UI in the browser
```

## Project layout

```
index.html               page structure
src/main.js              UI wiring (buttons, toggles, render calls)
src/parser.js            cleans pasted HTML, extracts blocks + metadata
src/differ.js            matches blocks between versions, classifies each
src/renderer.js          paints the highlighted side-by-side display
src/storage.js           save/load comparisons in local storage
src/styles.css           styling
tests/                   Vitest tests
samples/                 real Jadu HTML (gitignored)
```
