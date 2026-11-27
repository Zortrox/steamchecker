import "./assets/styles/steamcheckerStyles.css";
import svgGift from "./assets/images/gift.svg?raw";

import { clearConfigCache, loadConfig } from "./config/load-config";
import type { PageRule, SteamcheckerConfig } from "./config/schema";
import { AUTH_STORAGE_KEY } from "./lib/auth";
import {
  applyHighlight,
  matchPage,
  normalizeTitle,
  scanPage,
} from "./lib/page-scanner";
import { fetchAliases, fetchAppList } from "./lib/foxslash-api";
import type { SESD_Details, SteamcheckerExtensionSaveData } from "./types/foxslash-data";
import type { GameShortNames } from "./types/game-data";
import { TabMessage, sendToBackground, type TabResponse } from "./types/messages";
import {
  isSteamGameArray,
  type SteamGame,
  type SteamGameBasic,
} from "./types/steam-game";

/** Bump when `normalizeTitle` changes so cached short names are rebuilt. */
const SHORTNAME_FORMAT = "v2";

/** Attribute set on each processed wrapper, holding the title it was checked as. */
const PROCESSED_ATTR = "data-steamchecker";

type IndicatorStatus = "loading" | "good" | "error" | "not-scanning" | "signed-out";

const STATUS_TITLES: Record<IndicatorStatus, string> = {
  loading: "Loading...",
  good: "Everything looks good",
  error: "Error loading data",
  "not-scanning": "Not scanning on this URL",
  "signed-out": "Sign in to foxslash from the SteamChecker toolbar button",
};

function log(msg: unknown) {
  if (typeof msg === "string") {
    console.log("Steam Library Checker: " + msg);
  } else {
    console.log("Steam Library Checker:", msg);
  }
}

/**
 * Humble's site is a Next.js app: pages change without a reload and content
 * streams in after load. This watches the whole document, debounced, and
 * calls back on any DOM change or URL change.
 */
class PageWatcher {
  private timeout: number | undefined;
  private observer: MutationObserver;

  constructor(
    private onChange: () => void,
    private delayMs = 150,
  ) {
    this.observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (node) =>
            !(node instanceof Element && node.classList.contains("steamchecker-badge")),
        ),
      );
      if (relevant) this.schedule();
    });
  }

  start() {
    this.observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
    });
    window.addEventListener("popstate", () => this.schedule());
    this.schedule();
  }

  private schedule() {
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => this.onChange(), this.delayMs);
  }
}

class SteamChecker {
  private indicatorStatusElement: HTMLElement | null = null;

  private config: SteamcheckerConfig | undefined;
  private currentPath: string | undefined;
  private currentPage: PageRule | undefined;

  private ownedShortNames: GameShortNames | undefined;
  private wishedShortNames: GameShortNames | undefined;

  private badgeTemplate: Element | undefined;

  private timeStartPerformance = 0;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    this.setupIndicator();
    this.setStatus("loading");
    this.setupListeners();
    this.loadSvgAssets();

    try {
      const { config, source } = await loadConfig();
      this.config = config;
      log(`Using page config "${config.revision}" (${source})`);

      const userStatus = await this.loadUserData();
      if (userStatus !== "ok") {
        this.setStatus(userStatus);
        return;
      }

      new PageWatcher(() => this.onPageChange()).start();
    } catch (err) {
      log(err);
      this.setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Indicator

  private setupIndicator() {
    const indicator = document.createElement("div");
    indicator.id = "steamchecker-indicator";
    indicator.title = "SteamChecker";

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("icons/icon.png");
    img.alt = "SteamChecker";

    this.indicatorStatusElement = document.createElement("div");
    this.indicatorStatusElement.className = "steamchecker-status";

    indicator.append(img, this.indicatorStatusElement);
    document.body.appendChild(indicator);
  }

  private setStatus(status: IndicatorStatus) {
    const el = this.indicatorStatusElement;
    if (!el) return;

    el.className = `steamchecker-status steamchecker-status--${status}`;
    el.title = STATUS_TITLES[status];
  }

  // ---------------------------------------------------------------------------
  // Setup

  private setupListeners() {
    chrome.runtime.onMessage.addListener(
      (request, _, sendResponse: (response: TabResponse) => void) => {
        if (request.message === TabMessage.REMOVE_GAME_DATA) {
          Promise.all([this.removeAllStorageData(), clearConfigCache()]).then(() => {
            sendResponse({ message: "Game data removed" });
          });
          return true;
        }
        return undefined;
      },
    );

    // Signing in or out from the popup changes whose games apply; start over.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && AUTH_STORAGE_KEY in changes) {
        window.location.reload();
      }
    });
  }

  /** The flat gold badge with the present icon. */
  private loadSvgAssets() {
    const gift = new DOMParser().parseFromString(svgGift, "image/svg+xml").documentElement;
    gift.classList.add("steamchecker-gift");

    const badge = document.createElement("span");
    badge.className = "steamchecker-badge";
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", "On your Steam wishlist");
    badge.title = "On your Steam wishlist";
    badge.append(document.importNode(gift, true));
    this.badgeTemplate = badge;
  }

  // ---------------------------------------------------------------------------
  // Page scanning

  private onPageChange() {
    if (!this.config) return;

    if (window.location.pathname !== this.currentPath) {
      this.currentPath = window.location.pathname;
      this.currentPage = matchPage(this.config, this.currentPath);
      this.setStatus(this.currentPage ? "good" : "not-scanning");
      if (this.currentPage) log(`Scanning with page rule "${this.currentPage.id}"`);
    }

    if (this.currentPage) this.highlightGames(this.currentPage);
  }

  private highlightGames(page: PageRule) {
    if (!this.ownedShortNames || !this.wishedShortNames) return;

    this.timeStartPerformance = Date.now();
    let checked = 0;

    for (const game of scanPage(document, page)) {
      if (game.wrapper.getAttribute(PROCESSED_ATTR) === game.name) continue;
      game.wrapper.setAttribute(PROCESSED_ATTR, game.name);
      checked++;

      if (this.ownedShortNames[game.name]) {
        applyHighlight(game, "owned", this.badgeTemplate);
      }
      if (this.wishedShortNames[game.name]) {
        applyHighlight(game, "wished", this.badgeTemplate);
      }
    }

    if (checked > 0) {
      log(`(TIME) Checked ${checked} games: ${Date.now() - this.timeStartPerformance} ms`);
    }
  }

  // ---------------------------------------------------------------------------
  // Storage

  private async getStorageData<T extends (keyof SESD_Details)[]>(
    values: T,
  ): Promise<SteamcheckerExtensionSaveData<T[number]>> {
    return (await chrome.storage.local.get(values)) as SteamcheckerExtensionSaveData<
      T[number]
    >;
  }

  private async setStorageData(values: {
    [key in keyof SESD_Details]?: SESD_Details[key];
  }) {
    await chrome.storage.local.set(values);
  }

  private async removeAllStorageData() {
    const allKeys: Record<keyof SESD_Details, true> = {
      // old data
      numgames: true,
      shortnames: true,
      aliases: true,

      // new data
      wishlist_hash: true,
      wishlist_shortnames: true,
      owned_hash: true,
      owned_shortnames: true,
    };

    await chrome.storage.local.remove(Object.keys(allKeys));
    log("Game data removed.");
  }

  // ---------------------------------------------------------------------------
  // Foxslash data

  private async loadUserData(): Promise<"ok" | "signed-out" | "error"> {
    this.timeStartPerformance = Date.now();

    const [userGames, aliases, appList] = await Promise.all([
      sendToBackground({ type: "getUserGames" }),
      this.timed("Steam Aliases", fetchAliases(), {}),
      this.timed("Steam App List", fetchAppList(), { apps: [] }),
    ]);

    if (userGames.status === "signed-out") {
      log("Not signed in to foxslash");
      return "signed-out";
    }
    if (userGames.status === "error") {
      log(`Unable to load Steam data: ${userGames.error}`);
      return "error";
    }
    userGames.problems.forEach((problem) => log(`Unable to load ${problem}`));
    log(`(TIME) Steam Games and Wishlist: ${Date.now() - this.timeStartPerformance} ms`);

    const owned = userGames.owned ?? { steam_id: "", game_count: 0, games: [] };
    const wishlistIds = (userGames.wishlist?.appids ?? []).map(String);

    log("Loaded all data.");

    const storageGameData = await this.getStorageData([
      "numgames",
      "owned_hash",
      "wishlist_hash",
    ]);

    // remove pre-2024 storage data if it's still around
    if (storageGameData.numgames !== undefined) {
      await this.removeAllStorageData();
      storageGameData.owned_hash = undefined;
      storageGameData.wishlist_hash = undefined;
    }

    await Promise.all([
      this.processDataOwnedGames(owned.games, storageGameData.owned_hash, aliases),
      this.processDataWishlistGames(
        wishlistIds,
        storageGameData.wishlist_hash,
        aliases,
        appList.apps,
      ),
    ]);

    return "ok";
  }

  private async timed<T>(label: string, request: Promise<T>, fallback: T): Promise<T> {
    try {
      const result = await request;
      log(`(TIME) ${label}: ${Date.now() - this.timeStartPerformance} ms`);
      return result;
    } catch (err) {
      log(`Unable to load ${label}: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // Short names

  private loadAliases(
    gameArray: string[] | SteamGame[],
    aliasArray: Record<string, string[]>,
  ) {
    const ids = new Set(
      isSteamGameArray(gameArray)
        ? gameArray.map((game) => String(game.appid))
        : gameArray.map(String),
    );

    const addNames = new Set<string>();
    for (const [appID, aliases] of Object.entries(aliasArray)) {
      if (!ids.has(appID) || !Array.isArray(aliases)) continue;
      aliases.forEach((alias) => addNames.add(normalizeTitle(alias)));
    }

    if (addNames.size > 0) {
      log(`Aliases loaded: ${Array.from(addNames).join(", ")}`);
    }

    return addNames;
  }

  private hashGames(games: string[]) {
    const stringNames = SHORTNAME_FORMAT + ":" + games.join(",");

    let hash = 0;
    for (let i = 0; i < stringNames.length; i++) {
      hash = (hash << 5) - hash + stringNames.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  private toShortNameMap(names: string[] | undefined) {
    return names?.reduce((map, name) => {
      map[name] = true;
      return map;
    }, {} as GameShortNames);
  }

  private async processDataOwnedGames(
    ownedGames: SteamGame[],
    ownedHash: number | undefined,
    gameAliases: Record<string, string[]>,
  ) {
    const generatedHash = this.hashGames(ownedGames.map((game) => game.name));

    if (ownedHash === generatedHash) {
      this.ownedShortNames = this.toShortNameMap(
        (await this.getStorageData(["owned_shortnames"])).owned_shortnames,
      );
    }

    if (this.ownedShortNames) {
      log(`Loaded ${Object.keys(this.ownedShortNames).length} owned game short names`);
    } else {
      this.ownedShortNames = {};
      ownedGames.forEach((game) => {
        this.ownedShortNames![normalizeTitle(game.name)] = true;
      });

      const names = Object.keys(this.ownedShortNames);
      await this.setStorageData({ owned_hash: generatedHash, owned_shortnames: names });
      log(`Saved ${names.length} owned game short names`);
    }

    this.loadAliases(ownedGames, gameAliases).forEach((alias) => {
      this.ownedShortNames![alias] = true;
    });
  }

  private async processDataWishlistGames(
    wishlistGames: string[],
    wishlistHash: number | undefined,
    gameAliases: Record<string, string[]>,
    allGames: SteamGameBasic[],
  ) {
    const generatedHash = this.hashGames(wishlistGames);

    if (wishlistHash === generatedHash) {
      this.wishedShortNames = this.toShortNameMap(
        (await this.getStorageData(["wishlist_shortnames"])).wishlist_shortnames,
      );
    }

    if (this.wishedShortNames) {
      log(
        `Loaded ${Object.keys(this.wishedShortNames).length} wishlist game short names`,
      );
    } else {
      this.wishedShortNames = {};
      const namesById = new Map(allGames.map((app) => [String(app.appid), app.name]));

      wishlistGames.forEach((appID) => {
        const name = namesById.get(appID);
        if (name) this.wishedShortNames![normalizeTitle(name)] = true;
      });

      const names = Object.keys(this.wishedShortNames);
      // without the app list no names resolve; don't cache that empty result
      if (allGames.length > 0) {
        await this.setStorageData({
          wishlist_hash: generatedHash,
          wishlist_shortnames: names,
        });
        log(`Saved ${names.length} wishlist game short names`);
      }
    }

    this.loadAliases(wishlistGames, gameAliases).forEach((alias) => {
      this.wishedShortNames![alias] = true;
    });
  }
}

new SteamChecker();
