import {
  LIVE,
  expect,
  mockFoxslash,
  signInDirectly,
  serveFixture,
  test,
  waitForScan,
} from "./fixtures";
import type { Page } from "@playwright/test";

/** Computed styles that show whether the bundled CSS actually applied. */
async function styleOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      filter: style.filter,
      opacity: style.opacity,
      boxShadow: style.boxShadow,
      label: getComputedStyle(el, "::before").content,
      labelAfter: getComputedStyle(el, "::after").content,
    };
  });
}

test("bundle page: owned cards gray out, wishlisted cards get the gold wash and gift badge", async ({
  context,
  extensionId,
}, testInfo) => {
  await mockFoxslash(context, {
    owned: [
      { appid: 1623730, name: "Palworld" },
      { appid: 1604030, name: "V Rising" },
    ],
    wishlist: [{ appid: 848450, name: "Subnautica: Below Zero" }],
  });
  if (!LIVE) {
    await serveFixture(
      context,
      "https://www.humblebundle.com/games/survival-fittest",
      "humble-bundle-games.html",
    );
  }
  await signInDirectly(context, extensionId);

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/games/survival-fittest", {
    waitUntil: "domcontentloaded",
  });
  await waitForScan(page);

  await expect(page.locator("#steamchecker-indicator .steamchecker-status--good")).toHaveCount(1);
  await expect(page.locator(".steamchecker-ownedCard")).toHaveCount(2);
  await expect(page.locator(".steamchecker-wishedCard")).toHaveCount(1);
  await expect(page.locator(".steamchecker-wishedCard .steamchecker-badge")).toHaveCount(1);
  await expect(page.locator(".steamchecker-badge .steamchecker-gift")).toHaveCount(1);

  const owned = await styleOf(page, ".steamchecker-ownedCard");
  expect(owned.filter).toContain("grayscale(1)");
  expect(Number(owned.opacity)).toBeCloseTo(0.45, 2);
  expect(owned.label).toBe('"Owned"');

  const wished = await styleOf(page, ".steamchecker-wishedCard");
  expect(wished.boxShadow).not.toBe("none");
  const wishedDetails = await page.locator(".steamchecker-wishedCard").first().evaluate((el) => ({
    outlineWidth: getComputedStyle(el).outlineWidth,
    wash: getComputedStyle(el, "::after").backgroundImage,
    badgeText: getComputedStyle(el.querySelector(".steamchecker-badge")!, "::after").content,
    badgeBackground: getComputedStyle(el.querySelector(".steamchecker-badge")!).backgroundImage,
    badgeShadow: getComputedStyle(el.querySelector(".steamchecker-badge")!).boxShadow,
  }));
  expect(wishedDetails.outlineWidth).toBe("3px");
  expect(wishedDetails.wash).toContain("linear-gradient");
  expect(wishedDetails.badgeText).toBe("none");
  expect(wishedDetails.badgeBackground).toBe("none");
  expect(wishedDetails.badgeShadow).toBe("none");

  await page.locator(".steamchecker-ownedCard").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("bundle.png") });

  // close-up of an owned and a wishlisted card side by side
  const grid = page.locator("[data-testid=bundle-item-section-games] ul").first();
  await grid.evaluate((el) => el.scrollIntoView({ block: "start" }));
  const box = (await grid.boundingBox())!;
  await page.screenshot({
    path: testInfo.outputPath("bundle-cards.png"),
    clip: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: Math.min(box.height, 700) },
  });
});

test("home page: store product cards are checked", async ({ context, extensionId }, testInfo) => {
  await mockFoxslash(context, {
    owned: [{ appid: 526870, name: "Satisfactory" }],
    wishlist: [{ appid: 548430, name: "Deep Rock Galactic" }],
  });
  if (!LIVE) {
    await serveFixture(context, "https://www.humblebundle.com/", "humble-home.html");
  }
  await signInDirectly(context, extensionId);

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/", { waitUntil: "domcontentloaded" });
  await waitForScan(page);

  const owned = page.locator(".steamchecker-ownedCard");
  const wished = page.locator(".steamchecker-wishedCard");
  testInfo.annotations.push({
    type: "counts",
    description: `owned=${await owned.count()} wished=${await wished.count()}`,
  });
  expect(await owned.count()).toBeGreaterThan(0);
  expect(await wished.count()).toBeGreaterThan(0);
  await expect(wished.first().locator(".steamchecker-badge")).toHaveCount(1);

  await owned.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("home.png") });
  await wished.first().scrollIntoViewIfNeeded();
  await wished.first().screenshot({ path: testInfo.outputPath("home-wished.png") });
});

test("library page: Steam rows are labeled", async ({ context, extensionId }, testInfo) => {
  await mockFoxslash(context, {
    owned: [{ appid: 205100, name: "Dishonored" }],
    wishlist: [{ appid: 1256230, name: "Hyperbolica" }],
  });
  await serveFixture(
    context,
    "https://www.humblebundle.com/home/library",
    "humble-library-purchased.html",
  );
  await signInDirectly(context, extensionId);

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/home/library");
  await waitForScan(page);

  await expect(page.locator(".steamchecker-ownedLibraryRow")).toHaveCount(1);
  await expect(page.locator(".steamchecker-wishedLibraryRow")).toHaveCount(1);
  await expect(page.locator(".steamchecker-wishedLibraryRow > .steamchecker-badge")).toHaveCount(1);

  const owned = await styleOf(page, ".steamchecker-ownedLibraryRow");
  expect(owned.labelAfter).toBe('"In Steam library"');
  expect(Number(owned.opacity)).toBeCloseTo(0.5, 2);

  await page.screenshot({ path: testInfo.outputPath("library.png") });
});

test("library bundle page: Steam keys are labeled", async ({ context, extensionId }, testInfo) => {
  const url = "https://www.humblebundle.com/home/library/c7a551c0-0c4f-4397-adc6-2cf8d85c4fe2";
  await mockFoxslash(context, {
    owned: [{ appid: 205100, name: "Dishonored" }],
    wishlist: [{ appid: 1256230, name: "Hyperbolica" }],
  });
  await serveFixture(context, url, "humble-library-bundle-detail.html");
  await signInDirectly(context, extensionId);

  const page = await context.newPage();
  await page.goto(url);
  await waitForScan(page);

  await expect(page.locator(".steamchecker-ownedLibraryRow")).toHaveCount(1);
  await expect(page.locator(".steamchecker-wishedLibraryRow")).toHaveCount(1);
  await expect(page.locator(".steamchecker-wishedLibraryRow > .steamchecker-badge")).toHaveCount(1);

  const owned = await styleOf(page, ".steamchecker-ownedLibraryRow");
  expect(owned.labelAfter).toBe('"In Steam library"');

  await page.screenshot({ path: testInfo.outputPath("library-bundle.png"), fullPage: true });
});

test("store listing: grid cards and list rows are checked", async ({ context, extensionId }, testInfo) => {
  await mockFoxslash(context, {
    owned: [
      { appid: 526870, name: "Satisfactory" },
      { appid: 1151340, name: "Halloween: The Game" },
    ],
    wishlist: [{ appid: 1174180, name: "Red Dead Redemption 2" }],
  });
  for (const path of ["/store", "/on-sale"]) {
    await serveFixture(context, `https://www.humblebundle.com${path}`, "humble-store.html");
  }
  await signInDirectly(context, extensionId);

  for (const path of ["/store", "/on-sale"]) {
    const page = await context.newPage();
    await page.goto(`https://www.humblebundle.com${path}`);
    await waitForScan(page);

    await expect(page.locator(".steamchecker-ownedCard")).toHaveCount(2);
    await expect(page.locator(".steamchecker-wishedCard")).toHaveCount(1);
    await expect(page.locator(".steamchecker-wishedCard .steamchecker-badge")).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`store${path.replace(/\//g, "-")}.png`), fullPage: true });
    await page.close();
  }
});

test("indicator comes back if the page removes it", async ({ context, extensionId }) => {
  await mockFoxslash(context, { owned: [], wishlist: [] });
  await serveFixture(context, "https://www.humblebundle.com/store", "humble-store.html");
  await signInDirectly(context, extensionId);

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/store");
  await waitForScan(page);

  // What a React re-render of <body> does to nodes it didn't create.
  await page.evaluate(() => document.getElementById("steamchecker-indicator")?.remove());
  await expect(page.locator("#steamchecker-indicator")).toHaveCount(1);
});

test("signed-out users see the sign-in status and no highlights", async ({ context }) => {
  await mockFoxslash(context, {
    owned: [{ appid: 1623730, name: "Palworld" }],
    wishlist: [],
  });
  await serveFixture(
    context,
    "https://www.humblebundle.com/games/survival-fittest",
    "humble-bundle-games.html",
  );

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/games/survival-fittest");
  await waitForScan(page);

  await expect(page.locator(".steamchecker-status--signed-out")).toHaveCount(1);
  await expect(page.locator(".steamchecker-ownedCard")).toHaveCount(0);
});

test("unmatched page shows the not-scanning status", async ({ context, extensionId }) => {
  await mockFoxslash(context, { owned: [], wishlist: [] });
  if (!LIVE) {
    await context.route("https://www.humblebundle.com/about", (route) =>
      route.fulfill({ contentType: "text/html", body: "<html><body><h1>About</h1></body></html>" }),
    );
  }
  await signInDirectly(context, extensionId);

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/about", { waitUntil: "domcontentloaded" });
  await waitForScan(page);

  await expect(
    page.locator("#steamchecker-indicator .steamchecker-status--not-scanning"),
  ).toHaveCount(1);
});

test("popup uses the bundled Inter font", async ({ context, extensionId }, testInfo) => {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 280, height: 320 });
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await popup.evaluate(() => document.fonts.ready);

  expect(await popup.evaluate(() => document.fonts.check('16px "Inter"'))).toBe(true);
  const loaded = await popup.evaluate(() =>
    Array.from(document.fonts).filter((f) => f.family.includes("Inter") && f.status === "loaded").length,
  );
  expect(loaded).toBeGreaterThan(0);
  await popup.screenshot({ path: testInfo.outputPath("popup.png") });
});
