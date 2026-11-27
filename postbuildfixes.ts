import fs from "node:fs";

/**
 * Manifest adjustments @crxjs/vite-plugin has no options for. Runs after
 * `vite build` (see the `build` script).
 *
 * `<outDir>` stays the Chrome build. A copy at `<outDir>-firefox` gets the
 * Firefox background entry, since Chrome warns about `background.scripts` in
 * MV3 and Firefox doesn't run background service workers.
 */

const outDir = process.argv[2] ?? "dist";
const firefoxDir = `${outDir}-firefox`;
const manifestPath = `${outDir}/manifest.json`;

if (!fs.existsSync(manifestPath)) {
  console.error(`${manifestPath} not found; run vite build first.`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Chrome 130+ CSP: crxjs sets use_dynamic_url on web_accessible_resources,
// which breaks the content script loader. Remove it.
// https://github.com/pnd280/complexity/commit/ce9242a0538e86b88ee455b2dea55598f6c779db
for (const resource of manifest.web_accessible_resources ?? []) {
  delete resource.use_dynamic_url;
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Firefox: same files, background as an event page instead of a service worker.
const { service_worker: serviceWorker, ...background } = manifest.background ?? {};
if (!serviceWorker) {
  console.error(`${manifestPath} has no background.service_worker.`);
  process.exit(1);
}

fs.rmSync(firefoxDir, { recursive: true, force: true });
fs.cpSync(outDir, firefoxDir, { recursive: true });
fs.writeFileSync(
  `${firefoxDir}/manifest.json`,
  JSON.stringify({ ...manifest, background: { ...background, scripts: [serviceWorker] } }, null, 2),
);

console.log(`Patched ${outDir} (Chrome) and wrote ${firefoxDir} (Firefox).`);
