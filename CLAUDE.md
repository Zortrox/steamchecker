# SteamChecker

Browser extension (Chrome and Firefox, Manifest V3) that grays out games the
user owns on Steam and highlights wishlisted ones on humblebundle.com. Users
sign in to their foxslash account (Steam or email/password) from the popup;
there is no pasted SteamID. Owned games and wishlist come from the account's
linked Steam account. Everything comes from the foxslash API at `https://www.foxslash.com/api/steamchecker` (`src/lib/foxslash-api.ts`).
The old `/apps/steamchecker/*` URLs are only for already-released versions. The foxslash server is a
separate Laravel repo at `~/projects/foxslash`.

## Commands

- `bun install`: install (lockfile is `bun.lock`, CI uses `--frozen-lockfile`)
- `bun run dev`: Vite dev build with HMR, load `dist/` as an unpacked extension
- `bun run test`: Vitest against the HTML fixtures in `test/fixtures`
- `bun run build`: typecheck, Vite build to `dist/` (Chrome), `postbuildfixes.ts`
  writes `dist-firefox/`, then `extension-chrome.zip` and `extension-firefox.zip`
- `bun run build:local`: build to `dist-local/` against local foxslash on
  `http://localhost:8003` (Sail). Sign in there with an email/password account
  that has Steam linked; Steam login itself only works on the deployed site.
- `bun run lint:firefox`: `web-ext lint` on `dist-firefox/` (run after build)
- `bun run test:e2e`: builds `dist-e2e/`, then Playwright loads the extension
  into Chromium and checks sign-in, highlights and styles on fixture pages with
  mocked foxslash data (run after `build`; the highlight tests use `dist/`).
  `E2E_LIVE=1` uses the real humblebundle.com pages instead; `CHROMIUM_PATH`
  points at another Chromium build. Screenshots land in `test-results/`.
- `bun run check:config [url]`: validate the config foxslash serves
- `bun run fonts`: re-download popup fonts from Bunny Fonts into `src/assets/fonts`

Run `bun run test && bun run build && bun run lint:firefox && bun run test:e2e`
before calling a change done.

Local foxslash runs on Sail at `http://localhost:8003`. Build against it with
`VITE_FOXSLASH_API_URL=http://localhost:8003/api/steamchecker bun run dev`.

## Layout

- `src/background.ts`: holds the foxslash token. Runs the sign-in window
  (`identity.launchWebAuthFlow`, PKCE code handoff, see `docs/sign-in.md`) and
  makes the signed-in API calls for the popup and content script.
- `src/content.ts`: content script. Loads the page config, asks the background
  for the user's games, watches the DOM, applies highlights.
- `src/config/`: page config. `schema.ts` is the type and validator,
  `default-config.json` the bundled fallback, `load-config.ts` the
  fetch/cache/fallback logic. See `src/config/CLAUDE.md`.
- `src/lib/page-scanner.ts`: pure DOM functions (`matchPage`, `scanPage`,
  `applyHighlight`, `normalizeTitle`). Tests target these.
- `src/assets/styles/steamcheckerStyles.css`: all highlight CSS, by variant.
- `e2e/`: Playwright tests for the built extension. `fixtures.ts` mocks foxslash
  and serves saved pages.
- `src/pages/popup/`: sign-in popup (Tailwind 4, bundled Inter font).
- `manifest.config.ts`: manifest via `@crxjs/vite-plugin`.
- `postbuildfixes.ts`: strips `use_dynamic_url` from the built manifest
  (Chrome 130+ CSP workaround; keep it unless crxjs adds an option for it) and
  writes the Firefox copy `<outDir>-firefox/`. Both builds are MV3.
- `docs/remote-config.md`: JSON contract foxslash serves.
- `docs/sign-in.md`: sign-in handoff and authenticated API contract, plus the
  redirect URL allowlist.

## Rules

- No remote code. Never load JS, Wasm or CSS text from a server, and never add
  `eval`/`new Function`. Remote config is JSON data validated by
  `parseConfig`. New looks go in the bundled CSS as a new `class_type`.
- Keep one build that works in both browsers: MV3, background as a Chrome
  service worker in `dist/`, and a `dist-firefox/` copy with
  `background.scripts` written by `postbuildfixes.ts` (Chrome warns if MV3 has
  `background.scripts`, Firefox has no background service workers), `browser_specific_settings.gecko` for Firefox. Firefox requires
  `data_collection_permissions` (the foxslash account and Steam ID are used).
- The token lives only in `chrome.storage.local` under `foxslash_auth` and is
  only sent to the foxslash API by the background script. Never put it in sync
  storage, the page DOM, or a URL.
- Humble's site is a Next.js app. Pages change without reloads and content
  streams in, so scanning is driven by the `PageWatcher` MutationObserver, not
  by load events.
- Test fixtures are trimmed snapshots. Never commit raw saved pages: they
  contain the user's email, account IDs and gift keys.
- Prefer `data-testid`, `aria-label`, `href` prefixes and `img[alt]` in
  selectors over Tailwind utility classes, which Humble changes often.
