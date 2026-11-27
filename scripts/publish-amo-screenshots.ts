/**
 * Replace the Firefox Add-ons (AMO) listing screenshots with the PNGs in a
 * folder (default store-assets/screenshots, made by `bun run screenshots`).
 * Uploads the new images in file-name order, sets their captions, and only
 * then deletes the previews that were there before.
 *
 *   bun scripts/publish-amo-screenshots.ts [dir] [--dry-run]
 *
 * Needs WEB_EXT_API_KEY and WEB_EXT_API_SECRET (the AMO JWT issuer and secret,
 * same as `publish:firefox`). Chrome Web Store and Edge Add-ons have no API
 * for listing images; upload the same files in their dashboards.
 * API: https://mozilla.github.io/addons-server/topics/api/addons.html
 */
import { createHmac, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { requireEnv } from "./publish-env";

const ADDON = "@steamchecker"; // browser_specific_settings.gecko.id
const API = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(ADDON)}`;

/** Captions by file name; files without one get none. */
const CAPTIONS: Record<string, string> = {
  "1-bundle.png": "Bundle pages: games you own are grayed out, wishlisted games get a gold highlight.",
  "2-store.png": "Humble Store lists and rankings are checked too.",
  "3-on-sale.png": "Works on On Sale, Bestselling, genre and platform pages.",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dir = args.find((a) => !a.startsWith("--")) ?? "store-assets/screenshots";

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort()
  .map((f) => join(dir, f));
if (files.length === 0) {
  console.error(`No .png files in ${dir}. Run \`bun run screenshots\` first.`);
  process.exit(1);
}

const env = requireEnv(["WEB_EXT_API_KEY", "WEB_EXT_API_SECRET"] as const);

function base64url(data: string | Buffer) {
  return Buffer.from(data).toString("base64url");
}

/** AMO wants a fresh short-lived JWT per request (jti must not repeat). */
function authHeader() {
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({ iss: env.WEB_EXT_API_KEY, jti: randomUUID(), iat: now, exp: now + 60 }),
  );
  const signature = createHmac("sha256", env.WEB_EXT_API_SECRET)
    .update(`${head}.${body}`)
    .digest("base64url");
  return `JWT ${head}.${body}.${signature}`;
}

async function amo(path: string, init: RequestInit = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: { Authorization: authHeader(), ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path || "/"}: HTTP ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : undefined;
}

type Preview = { id: number; image_url: string; position?: number };

const addon = (await amo("/")) as { previews: Preview[] };
const old = addon.previews ?? [];
console.log(`Listing has ${old.length} screenshot(s); uploading ${files.length}:`);
files.forEach((f) => console.log(`  ${basename(f)}`));

if (dryRun) {
  console.log("Dry run: nothing changed.");
  process.exit(0);
}

for (const [index, file] of files.entries()) {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(readFileSync(file))], { type: "image/png" }), basename(file));
  // Positions go after the old previews until those are deleted.
  form.append("position", String(1000 + index));
  const created = (await amo("/previews/", { method: "POST", body: form })) as Preview;

  const caption = CAPTIONS[basename(file)];
  await amo(`/previews/${created.id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      position: index,
      ...(caption ? { caption: { "en-US": caption } } : {}),
    }),
  });
  console.log(`Uploaded ${basename(file)} as preview ${created.id}`);
}

for (const preview of old) {
  await amo(`/previews/${preview.id}/`, { method: "DELETE" });
  console.log(`Removed old preview ${preview.id}`);
}
console.log("Done. AMO listing screenshots replaced.");
