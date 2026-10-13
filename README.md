# Privyra — Privacy Scanner

A beginner-friendly static website starter for inspecting photo and PDF metadata and checking pasted text for common sensitive patterns.

## Files
- `index.html` — page structure
- `style.css` — styling and responsive layout
- `script.js` — client-side scanning logic

## Run locally
1. Download or extract the project.
2. Open `index.html` in a modern browser while connected to the internet.
3. Choose a supported photo or PDF and click Scan.

The app loads ExifReader and PDF.js from public CDNs, so an internet connection is required. Files selected for the photo/PDF scanners are processed in the browser by this page and are not intentionally uploaded to a backend.

## Publish with GitHub + Vercel
1. Create a GitHub repository named `privyra`.
2. Upload `index.html`, `style.css`, and `script.js` to the repository root.
3. Import that repository into Vercel.
4. For this plain static site, choose the `Other` framework preset. No build command is required; serve the project root.
5. Deploy and test the generated Vercel URL.

## Limitations and safety
- This is a starter tool, not a malware scanner or a guarantee that a file is safe.
- Metadata availability varies by format and file.
- Text matching is heuristic; results can include false positives and false negatives.
- Avoid pasting real passwords, private keys, tokens, or other secrets into any demo.
- Review third-party library versions and your project's security before using this as a production service.
