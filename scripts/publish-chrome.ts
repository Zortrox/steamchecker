/**
 * Upload a zip to the Chrome Web Store and submit it for review.
 *
 *   bun scripts/publish-chrome.ts extension-chrome.zip
 *
 * Env: CWS_EXTENSION_ID, CWS_PUBLISHER_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET,
 * CWS_REFRESH_TOKEN. See docs/publishing.md.
 */
import chromeWebstoreUpload from "chrome-webstore-upload";
import { requireEnv } from "./publish-env.ts";

const zipPath = process.argv[2] ?? "extension-chrome.zip";

const env = requireEnv([
  "CWS_EXTENSION_ID",
  "CWS_PUBLISHER_ID",
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
]);

const store = chromeWebstoreUpload({
  extensionId: env.CWS_EXTENSION_ID,
  publisherId: env.CWS_PUBLISHER_ID,
  clientId: env.CWS_CLIENT_ID,
  clientSecret: env.CWS_CLIENT_SECRET,
  refreshToken: env.CWS_REFRESH_TOKEN,
});

const token = await store.fetchToken();

console.log(`Uploading ${zipPath} to Chrome Web Store item ${env.CWS_EXTENSION_ID}`);
const upload = await store.uploadExisting(zipPath, token, 120);
console.log("Upload:", JSON.stringify(upload));

const publish = await store.publish("DEFAULT_PUBLISH", token);
console.log("Publish:", JSON.stringify(publish));
