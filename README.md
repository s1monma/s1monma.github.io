# Simon's Personal Website

This package contains the working personal homepage, the interactive flight log,
and the multilingual vocabulary explorer embedded inside the Language section.

## Run locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Important files

- `index.html` and `index.css`: personal homepage
- `flight.html`: interactive 84-flight archive
- `vocabulary/`: self-contained vocabulary explorer and its browser assets
- `vocabulary/source-tools/`: supplied maintenance/source scripts; these are
  retained for reference and are not loaded by the live website

The original homepage references some optional blog, image, and audio files that
were not supplied. Their absence does not prevent the homepage, flight archive,
or vocabulary explorer from loading.
