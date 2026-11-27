import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, test as base, type BrowserContext, type Page } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
/** Same as dist/ but the sign-in page points at MOCK_CONNECT_ORIGIN (see .env.e2e). */
export const DIST_E2E = join(ROOT, "dist-e2e");
export const MOCK_CONNECT_PORT = 47123;
const FOXSLASH = "https://www.foxslash.com/api/steamchecker";

export type MockSteamData = {
  owned: { appid: number; name: string }[];
  wishlist: { appid: number; name: string }[];
};

export const TEST_ACCOUNT = {
  name: "Test User",
  steam_id: "76561190000000000",
  steam_name: "tester",
  avatar_url: null,
};
export const TEST_TOKEN = "1|test-token";

/**
 * Fake foxslash: public data, the signed-in /me endpoints, and the sign-in
 * handoff (/extension/connect redirects straight back with a code).
 */
export async function mockFoxslash(context: BrowserContext, data: MockSteamData) {
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });
  const config = JSON.parse(
    readFileSync(join(ROOT, "src", "config", "default-config.json"), "utf8"),
  );
  const authorized = (auth: string | undefined) => auth === `Bearer ${TEST_TOKEN}`;

  await context.route(`${FOXSLASH}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const auth = (await request.headerValue("authorization")) ?? undefined;

    if (path.endsWith("/aliases")) return route.fulfill(json({}));
    if (path.endsWith("/apps")) {
      return route.fulfill(json({ apps: [...data.owned, ...data.wishlist] }));
    }
    if (path.endsWith("/config/v2")) return route.fulfill(json(config));

    if (path.endsWith("/token") && request.method() === "POST") {
      const body = request.postDataJSON();
      return body.code === "good-code" && body.code_verifier
        ? route.fulfill(json({ token: TEST_TOKEN, account: TEST_ACCOUNT }))
        : route.fulfill(json({ message: "Invalid code" }, 400));
    }

    if (!authorized(auth)) return route.fulfill(json({ message: "Unauthenticated." }, 401));
    if (path.endsWith("/me")) return route.fulfill(json(TEST_ACCOUNT));
    if (path.endsWith("/me/owned")) {
      return route.fulfill(
        json({ steam_id: "1", game_count: data.owned.length, games: data.owned }),
      );
    }
    if (path.endsWith("/me/wishlist")) {
      return route.fulfill(json({ steam_id: "1", appids: data.wishlist.map((g) => g.appid) }));
    }
    if (path.endsWith("/token") && request.method() === "DELETE") {
      return route.fulfill({ status: 204 });
    }
    return route.fulfill(json({ message: "not found" }, 404));
  });

}

/**
 * Stand-in for foxslash's /extension/connect: redirects straight back with a
 * code, as if the user was signed in and clicked Allow. Runs as a real local
 * server because Chrome's sign-in window bypasses Playwright routing.
 */
export function startMockConnectServer() {
  const requests: URL[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${MOCK_CONNECT_PORT}`);
    requests.push(url);
    const redirectUri = url.searchParams.get("redirect_uri");
    if (url.pathname !== "/extension/connect" || !redirectUri) {
      res.writeHead(404).end();
      return;
    }
    const back = new URL(redirectUri);
    back.searchParams.set("code", "good-code");
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { Location: back.toString() }).end();
  });
  return new Promise<{ requests: URL[]; close: () => Promise<void> }>((resolve) => {
    server.listen(MOCK_CONNECT_PORT, "127.0.0.1", () =>
      resolve({
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      }),
    );
  });
}

/**
 * Set E2E_LIVE=1 to run against the real humblebundle.com pages instead of the
 * saved fixtures. Live runs depend on what Humble is selling that day.
 */
export const LIVE = process.env.E2E_LIVE === "1";

/** Serve a saved fixture in place of a humblebundle.com URL (for logged-in pages). */
export async function serveFixture(context: BrowserContext, url: string, fixture: string) {
  const html = readFileSync(join(ROOT, "test", "fixtures", fixture), "utf8");
  await context.route(url, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: html }),
  );
}

/** Store a foxslash token directly, as if the user had signed in. */
export async function signInDirectly(context: BrowserContext, extensionId: string) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await page.evaluate(
    ([token, account]) =>
      chrome.storage.local.set({
        foxslash_auth: { token, account, signed_in_at: Date.now() },
      }),
    [TEST_TOKEN, TEST_ACCOUNT] as const,
  );
  await page.close();
}

/** Wait until the extension has finished scanning (or gave up). */
export async function waitForScan(page: Page) {
  await page.waitForSelector(
    "#steamchecker-indicator .steamchecker-status:not(.steamchecker-status--loading)",
    { timeout: 30_000 },
  );
  // let the debounced scanner run after the last DOM change
  await page.waitForTimeout(1500);
}

export const test = base.extend<{
  extensionDir: string;
  context: BrowserContext;
  extensionId: string;
}>({
  extensionDir: [DIST, { option: true }],
  context: async ({ extensionDir }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      // Use another Chromium build instead of Playwright's pinned one if set.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      headless: true,
      viewport: { width: 1400, height: 1000 },
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // No background worker, so read the id from the indicator icon the content script adds.
    const page = await context.newPage();
    await page.route("https://www.humblebundle.com/__id", (r) =>
      r.fulfill({ contentType: "text/html", body: "<html><body></body></html>" }),
    );
    await page.goto("https://www.humblebundle.com/__id");
    const src = await page
      .locator("#steamchecker-indicator img")
      .getAttribute("src", { timeout: 15_000 });
    await page.close();
    const id = src?.match(/^chrome-extension:\/\/([a-p]{32})\//)?.[1];
    if (!id) throw new Error(`could not read extension id from ${src}`);
    await use(id);
  },
});

export { expect } from "@playwright/test";
