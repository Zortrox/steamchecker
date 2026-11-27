# Publishing to the stores

Releases are automatic. A push to `main` with a `feat:` or `fix:` commit makes
semantic-release:

1. pick the next version and write it to `package.json`;
2. rebuild with that version (`prepareCmd` in `.releaserc`), producing
   `extension-chrome.zip`, `extension-firefox.zip` and `extension-source.zip`;
3. tag `vX.Y.Z` and attach the three zips to a GitHub release.

Then `.github/workflows/publish-stores.yml` uploads the release to each store
and submits it for review:

| Store | Zip | Script |
| --- | --- | --- |
| Chrome Web Store | `steamchecker-chrome.zip` | `scripts/publish-chrome.ts` |
| Firefox Add-ons (listed) | `steamchecker-firefox.zip`, with `steamchecker-source.zip` as the source upload | `web-ext sign` |
| Edge Add-ons | `steamchecker-chrome.zip` | `scripts/publish-edge.ts` |

Each store still reviews the update before users get it. Brave, Vivaldi and
other Chromium browsers install from the Chrome Web Store. Opera has no upload
API, so Opera stays manual.

Beta prereleases (the `beta` branch) get a GitHub release but are not sent to
the stores.

## Retrying or publishing by hand

Actions, **Publish to stores**, **Run workflow**: enter the tag (`v1.2.0`) and
pick one store or all. Locally, with the same environment variables set and
the release zips in the repo root:

```bash
bun run publish:chrome
```

```bash
bun run publish:firefox
```

```bash
bun run publish:edge
```

## Secrets

Add these under the repo's Settings, Secrets and variables, Actions. A store
with no secrets is skipped with a warning, so stores can be set up one at a
time. `GH_TOKEN` (already set) must be a token that can create releases.

### Chrome Web Store

| Secret | Where it comes from |
| --- | --- |
| `CWS_EXTENSION_ID` | The 32-letter item ID in the developer dashboard URL |
| `CWS_PUBLISHER_ID` | Your publisher ID, also in the developer dashboard URL |
| `CWS_CLIENT_ID` | Google Cloud OAuth client (Desktop app) with the Chrome Web Store API enabled |
| `CWS_CLIENT_SECRET` | Same OAuth client |
| `CWS_REFRESH_TOKEN` | From signing in once with that client as the publisher account |

The steps for the OAuth client and refresh token are in
<https://github.com/fregante/chrome-webstore-upload-keys>.

### Firefox Add-ons

| Secret | Where it comes from |
| --- | --- |
| `AMO_JWT_ISSUER` | <https://addons.mozilla.org/developers/addon/api/key/>, "JWT issuer" |
| `AMO_JWT_SECRET` | Same page, "JWT secret" |

The add-on ID is `@steamchecker` (`browser_specific_settings.gecko.id`), so
uploads go to the existing listing. AMO asks for source code because Vite
bundles the scripts; the workflow uploads `steamchecker-source.zip` (every
tracked file at the release, with the bumped `package.json`). Reviewers build it
with the steps under "Building from source" in the README.

### Edge Add-ons

| Secret | Where it comes from |
| --- | --- |
| `EDGE_PRODUCT_ID` | Partner Center, the extension's Overview page ("Product ID") |
| `EDGE_CLIENT_ID` | Partner Center, Publish API page, after enabling the API |
| `EDGE_API_KEY` | Same page; API keys expire, so renew it when uploads start failing with 401 |

The extension must already exist in Partner Center (the first submission is
manual).

## Sign-in redirect URLs

Each store gives the extension its own ID, and foxslash only redirects sign-in
to allowlisted URLs (`STEAMCHECKER_REDIRECT_URIS`, see `docs/sign-in.md`). Add
these before the first store release, or sign-in fails with a 400:

- Chrome: `https://<CWS_EXTENSION_ID>.chromiumapp.org/`
- Edge: `https://<Edge extension ID>.chromiumapp.org/` (the ID shown on
  `edge://extensions` after installing from the Edge store, not the product ID)
- Firefox: already listed (fixed by the `@steamchecker` ID)
