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
time. The release itself uses the workflow's built-in `GITHUB_TOKEN`, so
no personal access token is needed.

### Chrome Web Store

The upload runs as a Google service account. GitHub signs in to Google with
its own OIDC token (Workload Identity Federation), so there is no refresh
token or key file to store or rotate.

| Secret | Value |
| --- | --- |
| `CWS_EXTENSION_ID` | The 32-letter item ID |
| `CWS_PUBLISHER_ID` | Your publisher ID |
| `GCP_SERVICE_ACCOUNT` | The service account's email |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<project number>/locations/global/workloadIdentityPools/github/providers/steamchecker` |

1. **IDs.** Open the [developer dashboard](https://chrome.google.com/webstore/devconsole)
   signed in as the account that owns SteamChecker. The URL is
   `.../devconsole/<publisher id>/...`; opening the item adds
   `/<extension id>/...` after it.
2. **Google Cloud project.** Create a project in the
   [Cloud console](https://console.cloud.google.com/) (any name). Then, with
   the [gcloud CLI](https://cloud.google.com/sdk/docs/install) signed in as
   you (`gcloud auth login`):

   ```bash
   PROJECT_ID=your-project-id
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
   SA=steamchecker-publisher@$PROJECT_ID.iam.gserviceaccount.com

   gcloud services enable chromewebstore.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project $PROJECT_ID

   gcloud iam service-accounts create steamchecker-publisher --project $PROJECT_ID

   gcloud iam workload-identity-pools create github --project $PROJECT_ID --location global --display-name GitHub

   gcloud iam workload-identity-pools providers create-oidc steamchecker --project $PROJECT_ID --location global --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com --attribute-mapping 'google.subject=assertion.sub,attribute.repository=assertion.repository' --attribute-condition "assertion.repository=='Zortrox/steamchecker'"

   gcloud iam service-accounts add-iam-policy-binding $SA --project $PROJECT_ID --role roles/iam.workloadIdentityUser --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/Zortrox/steamchecker"

   echo "GCP_SERVICE_ACCOUNT=$SA"
   echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/steamchecker"
   ```

   The attribute condition means only workflows in this repo can use the
   pool. The service account needs no IAM roles in the project.
3. **Give it the publisher.** In the developer dashboard, Account, add the
   service account's email under **Service accounts**. A publisher can have
   one service account, and it can manage every item the publisher owns.

To publish from your own machine instead, grant yourself
`roles/iam.serviceAccountTokenCreator` on the service account and set
`CWS_ACCESS_TOKEN` before `bun run publish:chrome`:

```bash
export CWS_ACCESS_TOKEN=$(gcloud auth print-access-token --impersonate-service-account=$SA --scopes=https://www.googleapis.com/auth/chromewebstore)
```

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
gh secret set CWS_PUBLISHER_ID --repo Zortrox/steamchecker
```

## Store screenshots

`bun run screenshots` (after `bun run build`) opens the live humblebundle.com
bundle, Store and On Sale pages with the built extension and mocked foxslash
data, marks a few games on each page as owned or wishlisted, and saves
1280x800 PNGs to `store-assets/screenshots/` (git-ignored). 1280x800 is
accepted by all three stores. The pages change daily, so look at the images
before using them.

Only Firefox Add-ons has an API for listing images.
`bun run publish:amo-screenshots` (with `WEB_EXT_API_KEY` and
`WEB_EXT_API_SECRET` set) uploads the PNGs in file-name order with the captions
in `scripts/publish-amo-screenshots.ts`, then deletes the screenshots that were
there before. Add `-- --dry-run` to see what it would change. The Chrome Web
Store and Edge Add-ons APIs only take packages, so upload the same files in
their dashboards (Chrome: Store listing, Screenshots, up to 5; Edge: Partner
Center, Store listings).

In CI, run **Store screenshots** from the Actions tab. It keeps the PNGs as the
`store-screenshots` artifact and, with **upload_amo** ticked, replaces the AMO
screenshots. To refresh them after every release, set the repository variable
`UPDATE_STORE_SCREENSHOTS` to `true`; publish-stores then calls the same
workflow after the store uploads, as a separate job so a change on
humblebundle.com can't fail the release.

## Sign-in redirect URLs

Each store gives the extension its own ID, and foxslash only redirects sign-in
to allowlisted URLs (`STEAMCHECKER_REDIRECT_URIS`, see `docs/sign-in.md`). Add
these before the first store release, or sign-in fails with a 400:

- Chrome: `https://<CWS_EXTENSION_ID>.chromiumapp.org/`
- Edge: `https://<Edge extension ID>.chromiumapp.org/` (the ID shown on
  `edge://extensions` after installing from the Edge store, not the product ID)
- Firefox: already listed (fixed by the `@steamchecker` ID)
