/**
 * Upload a zip to the Chrome Web Store and submit it for review, using the
 * Chrome Web Store API v2 with a service account's access token.
 *
 *   bun scripts/publish-chrome.ts extension-chrome.zip
 *
 * Env: CWS_EXTENSION_ID, CWS_PUBLISHER_ID, CWS_ACCESS_TOKEN (an OAuth access
 * token for the publisher's service account, scope
 * https://www.googleapis.com/auth/chromewebstore). In CI the token comes from
 * google-github-actions/auth. See docs/publishing.md.
 * https://developer.chrome.com/docs/webstore/service-accounts
 */
import { requireEnv } from "./publish-env.ts";

const zipPath = process.argv[2] ?? "extension-chrome.zip";
const env = requireEnv(["CWS_EXTENSION_ID", "CWS_PUBLISHER_ID", "CWS_ACCESS_TOKEN"]);

const item = `publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_EXTENSION_ID}`;
const api = "https://chromewebstore.googleapis.com";
const auth = { Authorization: `Bearer ${env.CWS_ACCESS_TOKEN}` };

async function call(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, headers: { ...auth, ...init.headers } });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url}: ${response.status} ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

console.log(`Uploading ${zipPath} to Chrome Web Store item ${env.CWS_EXTENSION_ID}`);
const upload = await call(`${api}/upload/v2/${item}:upload`, {
  method: "POST",
  headers: { "X-Goog-Upload-Protocol": "raw", "X-Goog-Upload-File-Name": "extension.zip" },
  body: Bun.file(zipPath),
});
console.log("Upload:", JSON.stringify(upload));

// Large uploads finish asynchronously; poll the item until it settles (~2 minutes).
let state = upload.uploadState;
for (let attempt = 0; state === "IN_PROGRESS" && attempt < 60; attempt++) {
  await Bun.sleep(2000);
  state = (await call(`${api}/v2/${item}:fetchStatus`)).lastAsyncUploadState;
}
if (state !== "SUCCEEDED") {
  throw new Error(`Upload did not succeed: ${state}`);
}

const publish = await call(`${api}/v2/${item}:publish`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
});
console.log("Publish:", JSON.stringify(publish));
