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

| Secret | Value |
| --- | --- |
| `CWS_EXTENSION_ID` | The 32-letter item ID |
| `CWS_PUBLISHER_ID` | Your publisher ID |
| `CWS_CLIENT_ID` | OAuth client ID |
| `CWS_CLIENT_SECRET` | OAuth client secret |
| `CWS_REFRESH_TOKEN` | Refresh token for the publisher account |

1. **IDs.** Open the [developer dashboard](https://chrome.google.com/webstore/devconsole)
   signed in as the account that owns SteamChecker. The URL is
   `.../devconsole/<publisher id>/...`; opening the item adds
   `/<extension id>/...` after it.
2. **Google Cloud project.** In the [Cloud console](https://console.cloud.google.com/),
   create a project (any name), then under APIs & Services, Library, enable
   **Chrome Web Store API**.
3. **Consent screen.** APIs & Services, OAuth consent screen (Google Auth
   platform): type External, any app name, your email as support and developer
   contact. Then under Audience, click **Publish app** so it is "In production".
   A project left in "Testing" issues refresh tokens that expire after 7 days.
   Google won't make you verify the app for your own use; you'll just see an
   "unverified app" warning when you sign in.
4. **OAuth client.** Credentials (Clients), Create client, type **Web
   application**, authorized redirect URI
   `https://developers.google.com/oauthplayground`. Copy the client ID and
   secret.
5. **Refresh token.** Open the [OAuth Playground](https://developers.google.com/oauthplayground).
   Gear icon, tick "Use your own OAuth credentials", paste the client ID and
   secret. In "Input your own scopes" enter
   `https://www.googleapis.com/auth/chromewebstore`, click **Authorize APIs**,
   sign in as the publisher account and allow it (Advanced, Go to app, past the
   unverified warning). Click **Exchange authorization code for tokens** and
   copy the refresh token.

### Firefox Add-ons

| Secret | Value |
| --- | --- |
| `AMO_JWT_ISSUER` | "JWT issuer", like `user:12345678:123` |
| `AMO_JWT_SECRET` | "JWT secret" (shown once) |

Sign in to <https://addons.mozilla.org/developers/addon/api/key/> as the
account that owns SteamChecker, accept the agreement if asked, and click
**Generate new credentials**. Copy both values right away; the secret isn't
shown again (generate new ones if it's lost).

The add-on ID is `@steamchecker` (`browser_specific_settings.gecko.id`, the
same as past releases), so uploads go to the existing listing. AMO asks for
source code because Vite bundles the scripts; the workflow uploads
`steamchecker-source.zip` (every tracked file at the release, with the bumped
`package.json`). Reviewers build it with the steps under "Building from source"
in the README.

### Edge Add-ons

| Secret | Value |
| --- | --- |
| `EDGE_PRODUCT_ID` | The extension's Product ID (a GUID) |
| `EDGE_CLIENT_ID` | Publish API client ID |
| `EDGE_API_KEY` | Publish API key |

1. **Developer account.** Register for the Microsoft Edge program in
   [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/)
   with a Microsoft account (free).
2. **First submission, by hand.** The API can only update an extension that
   already exists. Create a new extension, upload `extension-chrome.zip` from
   a release (the Chrome build runs as is in Edge), fill in the listing
   (description, 300x300 logo, screenshots, a privacy policy URL, since the
   extension uses the foxslash account and Steam ID) and submit. Review takes
   up to 7 business days.
3. **Product ID.** On the extension's Overview page in Partner Center. This is
   the GUID, not the 32-letter extension ID.
4. **API credentials.** Partner Center, Microsoft Edge, **Publish API**. Enable
   the API if asked, then **Create API credentials**. Copy the client ID and
   API key. The key expires after 72 days; when uploads start failing with a
   401, create a new key and update `EDGE_API_KEY`.

The Edge extension ID (32 letters, shown under Extension identity in Partner
Center and on `edge://extensions` after installing from the store) is what
goes in the foxslash redirect allowlist below.

### Adding the secrets to GitHub

Repo Settings, Secrets and variables, Actions, **New repository secret**, once
per name. Or with the GitHub CLI, which prompts for the value so it stays out
of your shell history:

```bash
gh secret set CWS_REFRESH_TOKEN --repo Zortrox/steamchecker
```

## Sign-in redirect URLs

Each store gives the extension its own ID, and foxslash only redirects sign-in
to allowlisted URLs (`STEAMCHECKER_REDIRECT_URIS`, see `docs/sign-in.md`). Add
these before the first store release, or sign-in fails with a 400:

- Chrome: `https://<CWS_EXTENSION_ID>.chromiumapp.org/`
- Edge: `https://<Edge extension ID>.chromiumapp.org/` (the ID shown on
  `edge://extensions` after installing from the Edge store, not the product ID)
- Firefox: already listed (fixed by the `@steamchecker` ID)
