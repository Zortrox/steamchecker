import { beforeEach, describe, expect, it } from "vitest";

import bundledConfig from "../src/config/default-config.json";
import { parseConfig } from "../src/config/schema";
import {
  applyHighlight,
  matchPage,
  normalizeTitle,
  scanPage,
} from "../src/lib/page-scanner";
import { loadFixture } from "./helpers";

const config = parseConfig(bundledConfig);

function scan(fixture: string, pathname: string) {
  loadFixture(fixture);
  const page = matchPage(config, pathname);
  expect(page, `no page rule for ${pathname}`).toBeDefined();
  return scanPage(document, page!);
}

describe("normalizeTitle", () => {
  it("strips punctuation and collapses spaces", () => {
    expect(normalizeTitle("  The Elder Scrolls III: Morrowind®  GOTY ")).toBe(
      "the elder scrolls iii morrowind goty",
    );
  });
});

describe("matchPage", () => {
  it.each([
    ["/home/library", "library"],
    ["/home/library/c7a551c0-0c4f-4397-adc6-2cf8d85c4fe2", "library-bundle"],
    ["/games/survival-fittest", "bundle"],
    ["/software/some-bundle", "bundle"],
    ["/membership/december-2026", "membership"],
    ["/store", "home-and-store"],
    ["/store/satisfactory", "home-and-store"],
    ["/", "home-and-store"],
    ["/on-sale", "home-and-store"],
    ["/bestselling", "home-and-store"],
    ["/new-releases", "home-and-store"],
    ["/pre-order", "home-and-store"],
    ["/books-store", "home-and-store"],
    ["/software-store", "home-and-store"],
    ["/deals-under-5", "home-and-store"],
    ["/deals-under-10", "home-and-store"],
    ["/great-on-handhelds", "home-and-store"],
    ["/rpg", "home-and-store"],
    ["/all-genres", "home-and-store"],
    ["/nintendo-switch-2", "home-and-store"],
    ["/steam/", "home-and-store"],
    ["/all-platforms", "home-and-store"],
    ["/home/keys", "keys-legacy"],
  ])("%s -> %s", (path, id) => {
    expect(matchPage(config, path)?.id).toBe(id);
  });

  it("does not scan unrelated pages", () => {
    expect(matchPage(config, "/home/purchases")).toBeUndefined();
    expect(matchPage(config, "/home/library/content/abc")).toBeUndefined();
    expect(matchPage(config, "/about")).toBeUndefined();
    expect(matchPage(config, "/steamworks")).toBeUndefined();
    expect(matchPage(config, "/on-sale/extra")).toBeUndefined();
  });
});

describe("fixtures", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("library Purchased tab finds the Steam items", () => {
    const names = scan("humble-library-purchased.html", "/home/library").map((g) => g.name);
    expect(names).toEqual([
      "dishonored",
      "hyperbolica",
      "blazing chrome",
      "the elder scrolls iii morrowind goty",
      "arzette the jewel of faramore",
    ]);
  });

  it("library bundle page finds every Steam key", () => {
    const games = scan(
      "humble-library-bundle-detail.html",
      "/home/library/c7a551c0-0c4f-4397-adc6-2cf8d85c4fe2",
    );
    expect(games.map((g) => g.name)).toEqual([
      "arzette the jewel of faramore",
      "dishonored",
      "blazing chrome",
      "the elder scrolls iii morrowind goty",
      "pennys big breakaway",
      "hyperbolica",
      "nickelodeon allstar brawl 2",
    ]);
    games.forEach((g) => expect(g.wrapper.classList.contains("bg-card")).toBe(true));
  });

  it("library Bundles tab finds nothing to check", () => {
    expect(scan("humble-library-bundles.html", "/home/library")).toHaveLength(0);
  });

  it("bundle page finds every game item", () => {
    const names = scan("humble-bundle-games.html", "/games/survival-fittest").map(
      (g) => g.name,
    );
    expect(names).toHaveLength(12);
    expect(names).toContain("palworld");
    expect(names).toContain("subnautica below zero");
  });

  it("store page reads list rows without their rank number", () => {
    const games = scan("humble-store.html", "/store");
    expect(games.map((g) => g.name)).toEqual([
      "control resonant",
      "bonelab",
      "satisfactory",
      "for the king ii",
      "warhammer 40000 space marine 2 2year anniversary edition",
      "final fantasy vii remake intergrade",
      "halloween the game",
      "red dead redemption 2",
    ]);
    expect(new Set(games.map((g) => g.wrapper)).size).toBe(games.length);
  });

  it("home page finds store products but skips bundle cards", () => {
    const games = scan("humble-home.html", "/");
    const names = games.map((g) => g.name);
    expect(names).toContain("satisfactory");
    expect(names).toContain("deep rock galactic");
    expect(names.some((n) => n.includes("bundle"))).toBe(false);
    games.forEach((g) =>
      expect(g.wrapper.querySelector('a[href^="/store/"]')).not.toBeNull(),
    );
  });
});

describe("applyHighlight", () => {
  it("adds the variant class and one wishlist badge", () => {
    const games = scan("humble-bundle-games.html", "/games/survival-fittest");
    const badge = document.createElement("span");
    badge.className = "steamchecker-badge";

    applyHighlight(games[0]!, "wished", badge);
    applyHighlight(games[0]!, "wished", badge);

    expect(games[0]!.wrapper.classList.contains("steamchecker-wishedCard")).toBe(true);
    expect(games[0]!.wrapper.querySelectorAll(".steamchecker-badge")).toHaveLength(1);
  });

  it("puts the library badge on the row itself", () => {
    const games = scan("humble-library-purchased.html", "/home/library");
    const badge = document.createElement("span");
    badge.className = "steamchecker-badge";

    applyHighlight(games[1]!, "wished", badge);

    expect(games[1]!.wrapper.querySelector(":scope > .steamchecker-badge")).not.toBeNull();
  });
});
