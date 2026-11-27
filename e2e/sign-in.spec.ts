import {
  DIST_E2E,
  TEST_ACCOUNT,
  expect,
  mockFoxslash,
  serveFixture,
  startMockConnectServer,
  test,
  waitForScan,
} from "./fixtures";

test.use({ extensionDir: DIST_E2E });

test("sign in from the popup, see highlights, sign out", async ({ context, extensionId }, testInfo) => {
  await mockFoxslash(context, {
    owned: [{ appid: 1623730, name: "Palworld" }],
    wishlist: [{ appid: 848450, name: "Subnautica: Below Zero" }],
  });
  await serveFixture(
    context,
    "https://www.humblebundle.com/games/survival-fittest",
    "humble-bundle-games.html",
  );

  const connect = await startMockConnectServer();
  try {

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 280, height: 300 });
  await popup.goto(`chrome-extension://${extensionId}/src/pages/popup/index.html`);
  await expect(popup.locator("#signInButton")).toBeVisible();
  await popup.screenshot({ path: testInfo.outputPath("popup-signed-out.png") });

  await popup.click("#signInButton");
  await expect(popup.locator("#account-name")).toHaveText(TEST_ACCOUNT.name, { timeout: 20_000 });
  await expect(popup.locator("#account-steam")).toHaveText(`Steam: ${TEST_ACCOUNT.steam_name}`);
  await popup.screenshot({ path: testInfo.outputPath("popup-signed-in.png") });

  const sent = connect.requests[0]!;
  expect(sent.searchParams.get("redirect_uri")).toMatch(/^https:\/\/[a-p]{32}\.chromiumapp\.org\/$/);
  expect(sent.searchParams.get("code_challenge_method")).toBe("S256");
  expect(sent.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);

  const page = await context.newPage();
  await page.goto("https://www.humblebundle.com/games/survival-fittest");
  await waitForScan(page);
  await expect(page.locator(".steamchecker-ownedCard")).toHaveCount(1);
  await expect(page.locator(".steamchecker-wishedCard")).toHaveCount(1);

  // Signing out reloads Humble tabs, which then show the signed-out status.
  await popup.click("#signOutButton");
  await expect(popup.locator("#signInButton")).toBeVisible();
  await page.waitForLoadState("domcontentloaded");
  await waitForScan(page);
  await expect(page.locator(".steamchecker-status--signed-out")).toHaveCount(1);
  await expect(page.locator(".steamchecker-ownedCard")).toHaveCount(0);
  } finally {
    await connect.close();
  }
});
