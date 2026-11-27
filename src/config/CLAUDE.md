# Page config

When Humble changes its markup, fix it here and on foxslash. A server-only
change reaches installed extensions within the 6 hour cache window, with no
store release.

## Updating selectors after a Humble redesign

1. Save the affected page and add a trimmed fixture to `test/fixtures/`. Keep
   only the game list markup, and strip scripts, image URLs and anything tied to
   the user's account (email, user IDs, Steam ID, keys).
2. Add or adjust a test in `test/page-scanner.test.ts` that expects the right
   titles from that fixture.
3. Edit `default-config.json` until the test passes. Bump `revision`.
4. Copy the same JSON to `~/projects/foxslash/resources/steamchecker/config-v2.json`,
   which foxslash serves at `/api/steamchecker/config/v2`. Nothing syncs the
   two files automatically. Then run `bun run check:config`. See
   `docs/remote-config.md`.

## Changing the schema

- Additive optional fields: add to `TargetRule` and `parseTarget`, keep
  `schema_version` at 2. Old extensions ignore unknown fields.
- Breaking changes: bump `CONFIG_SCHEMA_VERSION`, serve the new document at a
  new URL (`/config/v3/`), and keep `/config/v2/` live for older installs.
- New visual treatments: add CSS for `steamchecker-owned<Name>` and
  `steamchecker-wished<Name>` in `steamcheckerStyles.css`, add `<Name>` to
  `STYLE_VARIANTS`, and ship a release before the server uses it. Older builds
  reject configs that name an unknown variant and fall back to their cached or
  bundled copy.
- Keep the value checks in `schema.ts`. They keep the remote config data-only,
  which the Chrome Web Store and AMO policies require.

## Unverified entries

`membership` was written without a rendered Choice page (the page needs
JavaScript to render games). `home-and-store` covers the home page, `/store` and the
store pages in Humble's Store menu (`/on-sale`, `/bestselling`, genre and
platform pages); their paths are listed one by one in the rule, so a new menu
entry needs adding there. All of them use the same `product-card` markup,
captured in `humble-store.html` (list rows have a rank number, which the
title selector skips). `keys-legacy` targets the old keys table and may
be dead if `/home/keys` now redirects to the library. Check both against a live
page.
