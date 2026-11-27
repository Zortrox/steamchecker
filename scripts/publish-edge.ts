/**
 * Upload a zip to Microsoft Edge Add-ons and submit it for review, using the
 * Edge Add-ons API v1.1 (API key auth).
 *
 *   bun scripts/publish-edge.ts extension-chrome.zip
 *
 * Env: EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY, and optionally
 * RELEASE_VERSION for the submission notes. See docs/publishing.md.
 * https://learn.microsoft.com/microsoft-edge/extensions/update/api/using-addons-api
 */
import { requireEnv } from "./publish-env.ts";

const zipPath = process.argv[2] ?? "extension-chrome.zip";
const env = requireEnv(["EDGE_PRODUCT_ID", "EDGE_CLIENT_ID", "EDGE_API_KEY"]);

const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${env.EDGE_PRODUCT_ID}/submissions`;
const headers = {
  Authorization: `ApiKey ${env.EDGE_API_KEY}`,
  "X-ClientID": env.EDGE_CLIENT_ID,
};

type Operation = { status: string; message?: string | null; errors?: unknown };

/** Start an operation and return its ID from the Location header. */
async function start(url: string, init: RequestInit): Promise<string> {
  const response = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
  if (response.status !== 202) {
    throw new Error(`${init.method} ${url}: ${response.status} ${await response.text()}`);
  }
  const location = response.headers.get("Location");
  if (!location) throw new Error(`${url}: no operation ID in Location header`);
  return location.split("/").pop()!;
}

/** Poll an operation until it leaves InProgress (up to ~5 minutes). */
async function wait(url: string): Promise<Operation> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`GET ${url}: ${response.status} ${await response.text()}`);
    }
    const operation = (await response.json()) as Operation;
    if (operation.status !== "InProgress") return operation;
    await Bun.sleep(5000);
  }
  throw new Error(`${url}: still in progress after 5 minutes`);
}

function check(step: string, operation: Operation) {
  console.log(`${step}:`, JSON.stringify(operation));
  if (operation.status !== "Succeeded") {
    throw new Error(`${step} failed: ${operation.message ?? operation.status}`);
  }
}

console.log(`Uploading ${zipPath} to Edge Add-ons product ${env.EDGE_PRODUCT_ID}`);
const uploadId = await start(`${base}/draft/package`, {
  method: "POST",
  headers: { "Content-Type": "application/zip" },
  body: Bun.file(zipPath),
});
check("Upload", await wait(`${base}/draft/package/operations/${uploadId}`));

const notes = process.env.RELEASE_VERSION
  ? `Release ${process.env.RELEASE_VERSION}`
  : "New release";
const publishId = await start(base, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ notes }),
});
check("Publish", await wait(`${base}/operations/${publishId}`));
