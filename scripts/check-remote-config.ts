/**
 * Fetch the page config foxslash serves and run it through the extension's
 * validator. Also reports whether it differs from the bundled copy.
 *
 *   bun run check:config                      # production
 *   bun run check:config http://localhost/api/steamchecker/config/v2
 */
import { Window } from "happy-dom";

import bundledConfig from "../src/config/default-config.json";

// parseConfig checks selectors with querySelector, so it needs a DOM.
const window = new Window();
Object.assign(globalThis, { document: window.document });
const { parseConfig } = await import("../src/config/schema");

const url = process.argv[2] ?? "https://www.foxslash.com/api/steamchecker/config/v2";

const response = await fetch(url, { headers: { Accept: "application/json" } });
console.log(`${url} -> HTTP ${response.status}`);
console.log(`  content-type: ${response.headers.get("content-type")}`);
console.log(`  access-control-allow-origin: ${response.headers.get("access-control-allow-origin")}`);
if (!response.ok) process.exit(1);

const raw = await response.json();
try {
  const config = parseConfig(raw);
  console.log(`  valid: revision "${config.revision}", ${config.pages.length} pages`);
} catch (err) {
  console.error(`  INVALID: ${(err as Error).message}`);
  process.exit(1);
}

const same = JSON.stringify(raw) === JSON.stringify(bundledConfig);
console.log(same ? "  matches src/config/default-config.json" : "  DIFFERS from src/config/default-config.json");
if (response.headers.get("access-control-allow-origin") !== "*") {
  console.error("  missing Access-Control-Allow-Origin: * (content script fetch will fail)");
  process.exit(1);
}
