import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowserContext, Page } from "@playwright/test";

import {
  expect,
  mockFoxslash,
  signInDirectly,
  test,
  type MockSteamData,
} from "../e2e/fixtures";

/**
 * Store listing screenshots, taken on the live humblebundle.com pages with
 * mocked foxslash data, so they show Humble's current design and no real
 * account. Writes 1280x800 PNGs (the size Chrome, Edge and AMO accept) to
 * store-assets/screenshots/. Run with `bun run screenshots`.
 */

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "store-assets", "screenshots");
const HUMBLE = "https://www.humblebundle.com";
const VIEWPORT = { width: 1280, height: 800 };

// Hide the cookie banner and ad/tracking iframes; they are not part of the page we want to show.
const HIDE = `#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter, iframe
  { display: none !important; }`;

type Shot = {
  file: string;
  path: string | (() => Promise<string>);
  /** Cards on the page, in order: wrapper selector and how to read the title. */
  cards: string;
  title: string;
  titleAttribute?: string;
  /** Indexes of cards to mark owned and wishlisted. */
  owned: number[];
  wished: number[];
  /** Element to scroll to the top of the viewport before the screenshot. */
  scrollTo: string;
};

const STORE_CARD = '[data-testid="product-card"]';
const STORE_TITLE =
  '[data-testid="product-card-footer"] [data-testid="product-link"] > div > div > div:not([data-testid])';

const shots: Shot[] = [
  {
    file: "1-bundle.png",
    path: () => firstGameBundle(),
    cards: '[data-testid="bundle-item-card"]',
    title: '[data-testid="product-thumbnail"] img',
    titleAttribute: "alt",
    owned: [0, 3, 4],
    wished: [2],
    scrollTo: '[data-testid="bundle-item-card"]',
  },
  {
    file: "2-store.png",
    path: "/store",
    cards: STORE_CARD,
    title: STORE_TITLE,
    owned: [1, 4, 7],
    wished: [2],
    scrollTo: '[data-testid="products-list-column"]',
  },
  {
    file: "3-on-sale.png",
    path: "/on-sale",
    cards: STORE_CARD,
    title: STORE_TITLE,
    owned: [0, 3, 6, 7],
    wished: [1, 9],
    scrollTo: STORE_CARD,
  },
];

let bundlePath: string | undefined;

/** The newest game bundle from /games, since bundle URLs change every few weeks. */
async function firstGameBundle() {
  if (bundlePath) return bundlePath;
  throw new Error("bundle path not resolved");
}

async function openPage(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);
  await page.goto(HUMBLE + path, { waitUntil: "domcontentloaded" });
  return page;
}

async function readTitles(page: Page, shot: Shot) {
  await page.waitForSelector(shot.cards, { timeout: 30_000 });
  return page.$$eval(
    shot.cards,
    (cards, { title, attr }) =>
      cards.map((card) => {
        const el = card.querySelector(title);
        return ((attr ? el?.getAttribute(attr) : el?.textContent) ?? "").trim();
      }),
    { title: shot.title, attr: shot.titleAttribute },
  );
}

test.use({ viewport: VIEWPORT });

test("store listing screenshots", async ({ context, extensionId }) => {
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });

  // Data the mocked foxslash serves; filled in per page before signing in.
  const data: MockSteamData = { owned: [], wishlist: [] };
  await mockFoxslash(context, data);

  const listing = await openPage(context, "/games");
  const href = await listing
    .locator('a[href^="/games/"]')
    .first()
    .getAttribute("href", { timeout: 30_000 });
  await listing.close();
  expect(href, "no game bundle linked from /games").toBeTruthy();
  bundlePath = new URL(href!, HUMBLE).pathname;

  // Read every page's titles before signing in, so the extension fetches the
  // owned games and wishlist once, with all of them in place.
  const titles = new Map<Shot, string[]>();
  for (const shot of shots) {
    const path = typeof shot.path === "string" ? shot.path : await shot.path();
    const page = await openPage(context, path);
    const names = await readTitles(page, shot);
    await page.close();
    titles.set(shot, names);
    let appid = 900_000 + shots.indexOf(shot) * 100;
    for (const i of shot.owned) if (names[i]) data.owned.push({ appid: appid++, name: names[i] });
    for (const i of shot.wished) if (names[i]) data.wishlist.push({ appid: appid++, name: names[i] });
  }

  await signInDirectly(context, extensionId);

  for (const shot of shots) {
    const path = typeof shot.path === "string" ? shot.path : await shot.path();
    const page = await openPage(context, path);
    await page.waitForSelector(shot.cards, { timeout: 30_000 });
    // The scan is done once the status leaves "loading" (it may be off screen, so don't require visible).
    await page.waitForSelector(
      "#steamchecker-indicator .steamchecker-status:not(.steamchecker-status--loading)",
      { state: "attached", timeout: 30_000 },
    );
    await page.waitForTimeout(1500);
    await expect(page.locator("[class*='steamchecker-owned']").first()).toBeVisible();

    await page.locator(shot.scrollTo).first().evaluate((el) => {
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24);
    });
    // Added only now: a <style> injected before Next.js hydrates makes React
    // re-render the document, which drops the extension's indicator.
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(1000); // lazy images
    await page.screenshot({ path: join(OUT, shot.file) });
    await page.close();
  }
});
