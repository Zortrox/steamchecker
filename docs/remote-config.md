# Remote page config (foxslash contract)

The extension decides where games are on each Humble page from a JSON config.
foxslash serves the live copy so selectors and style tweaks can change without
shipping a new extension build. The same JSON is bundled at
`src/config/default-config.json` and used when the server can't be reached.

## Endpoint

```
GET https://www.foxslash.com/api/steamchecker/config/v2
```

It sits next to the rest of the extension's API (`/api/steamchecker/profiles/{profile}/owned`,
`/profiles/{profile}/wishlist`, `/aliases`, `/apps`). Check a deployed copy with
`bun run check:config [url]`, which runs it through the extension's validator.

- Response: `application/json`, the document described below.
- CORS: must send `Access-Control-Allow-Origin: *` (or
  `https://www.humblebundle.com`). The request comes from the content script on
  humblebundle.com, so it is subject to CORS in Chrome and Firefox.
- Caching: the extension caches a good response for 6 hours in
  `chrome.storage.local` and falls back to the stale copy, then the bundled
  copy, if the endpoint fails or returns something invalid. Short HTTP cache
  headers (e.g. `max-age=300`) are fine.
- The old `/apps/steamchecker/*` endpoints (including `/selectors/`) must keep
  working unchanged for extension versions already installed.

Simplest server implementation: return the contents of
`src/config/default-config.json` from this repo, edited as needed. A Filament
editor that stores the JSON and validates it with the rules below is the
fuller version.

## Document

```jsonc
{
  "schema_version": 2,              // must be exactly 2
  "revision": "2026-11-26a",        // any label; logged in the console
  "pages": [
    {
      "id": "bundle",               // name for logs/tests
      "path": "^/(games|software|books)/[^/]+",  // JS regex on location.pathname
      "targets": [
        {
          "id": "bundle-items",
          "game_wrapper": "[data-testid=\"bundle-item-card\"]",   // one per game
          "title": "[data-testid=\"product-thumbnail\"] img",     // inside wrapper
          "title_attribute": "alt",        // optional: read attr instead of text
          "require": "[aria-label=\"Steam\"]",  // optional: wrapper must contain
          "highlight": null,               // optional: element to style, default wrapper
          "badge": "[data-testid=\"product-thumbnail\"]",  // optional: where the gold gift badge goes (":scope" = wrapper)
          "class_type": "Card",            // bundled style variant, see below
          "style_vars": { "--sc-owned-opacity": "0.4" },  // optional
          "extra_styles": { ":scope": { "paddingLeft": "10px" } } // optional
        }
      ]
    }
  ]
}
```

The first page whose `path` matches wins. Pages that match nothing show the
grey "not scanning" dot.

### Rules the extension enforces

A config that breaks any rule is rejected as a whole (and the previous good copy
is used), so validate on the server before saving.

- Every selector must parse with `querySelector`; every `path` must be a valid
  JS regex.
- `class_type` is one of `Card`, `LibraryRow`, `Game`, `Key`. Each maps to
  CSS that ships in the extension (`steamchecker-owned<Type>`,
  `steamchecker-wished<Type>`). New looks need a new extension release.
- `style_vars` names must match `--sc-[a-z0-9-]+`.
- `extra_styles` properties must be in `ALLOWED_STYLE_PROPERTIES` in
  `src/config/schema.ts` (layout and spacing only).
- No value may contain `url(`, `expression(`, `javascript:`, `@import`, or any
  of `< > { } ; \`.

### Style variables

| Variable | Used by | Default |
| --- | --- | --- |
| `--sc-owned-filter` | Card, LibraryRow | `grayscale(1)` |
| `--sc-owned-opacity` | Card, LibraryRow | `0.45` / `0.5` |
| `--sc-owned-hover-opacity` | Card, LibraryRow | `0.85` / `0.9` |
| `--sc-owned-label` | Card, LibraryRow | `"Owned"` / `"In Steam library"` (CSS string, keep the quotes) |
| `--sc-label-display` | Card, LibraryRow | `block` (`none` hides the label) |
| `--sc-label-space` | LibraryRow | `136px` (set `0` when hiding the label) |
| `--sc-wished-color` | Card, LibraryRow, badge | `#ffc400` |
| `--sc-wished-outline-width` | Card, LibraryRow | `3px` |
| `--sc-wished-tint` | Card, LibraryRow | `45%` (strength of the gold wash) |
| `--sc-badge-display` | badge | `inline-flex` (`none` hides it) |
| `--sc-gift-size` | badge | `22px` |

## Why data only

Chrome Web Store (MV3) bans remotely hosted code, meaning JS and Wasm, but
allows remote configuration when all logic ships in the package. Mozilla's
policy says add-ons "must be self-contained and not load remote code for
execution" and doesn't settle whether remote CSS counts. Both stores' docs are
unclear about remote stylesheets, so the extension never loads CSS text from the
server. It loads only this JSON, validates it, and uses it to pick bundled
styles and set a few inline values. That stays on the safe side of both
policies.
