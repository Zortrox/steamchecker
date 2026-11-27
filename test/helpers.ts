import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Load a saved Humble page from test/fixtures into the test document. */
export function loadFixture(name: string) {
  const html = readFileSync(join(__dirname, "fixtures", name), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
}
