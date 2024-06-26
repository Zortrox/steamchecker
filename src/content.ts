// content.js

import './assets/styles/steamcheckerStyles.css';
import svgStar from './assets/images/star.svg?raw';

import type {
  FoxslashResponseAliases,
  FoxslashResponseModeWebpageSelectors,
  FoxslashResponseOwnedGames,
  FoxslashResponseOwnedGamesWithAliases,
  FoxslashResponseSteamAppList,
  FoxslashResponseWishlist,
  SESD_Details,
  SteamcheckerExtensionSaveData,
  SteamcheckerFoundGameElement,
  SteamcheckerWebpageSelectors,
} from './types/foxslash-data';
import type { GameData, GameShortNames } from './types/game-data';
import { TabMessage, type TabResponse } from './types/messages';
import {
  isSteamGameArray,
  type SteamGame,
  type SteamGameBasic,
} from './types/steam-game';
import type { SteamIDSettings } from './types/steamid-settings';

class SteamCheckerMutationListener {
  private timeout: number | undefined;

  private config = { subtree: true, childList: true };

  private observer = new MutationObserver((mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (
        mutation.type === 'childList' &&
        mutation.target.nodeName.toLowerCase() !== 'i'
      ) {
        this.nodeAdded();
      }
    });
  });

  private nodeAddedCallback: () => void;

  constructor(observerCallback: () => void) {
    this.nodeAddedCallback = observerCallback;
  }

  private waitForAddedNode(parentNode: string) {
    let elem = document.querySelector(parentNode);

    if (elem) {
      this.nodeAdded();
      this.observer.observe(elem, this.config);
    } else {
      new MutationObserver(() => {
        let elem = document.querySelector(parentNode);
        if (!elem) return;

        this.disconnect();
        this.observer.observe(elem, this.config);
      }).observe(document, {
        subtree: true,
        childList: true,
      });
    }
  }

  private nodeAdded() {
    let waitTime = 100;

    clearTimeout(this.timeout);

    this.timeout = window.setTimeout(() => {
      this.nodeAddedCallback();
    }, waitTime);
  }

  public observe(parentNode: string) {
    this.waitForAddedNode(parentNode);
  }

  public disconnect() {
    this.observer.disconnect();
  }
}

class SteamChecker {
  private storageTypeUserData:
    | chrome.storage.SyncStorageArea
    | chrome.storage.LocalStorageArea;

  private webpageSelectorSettings: SteamcheckerWebpageSelectors[] | undefined;

  // arrays for games currently on webpage
  private webpageGames: SteamcheckerFoundGameElement[] = [];
  // private machineNames: string[] = [];

  // arrays for game names + aliases
  private ownedShortNames: GameShortNames | undefined;
  private wishedShortNames: GameShortNames | undefined;

  private svgAssets: Record<'star', HTMLElement> | undefined;

  // timing
  private timeStartPerformance: number = 0;

  constructor() {
    if (typeof chrome.storage.sync !== 'undefined') {
      this.storageTypeUserData = chrome.storage.sync;
    } else {
      this.storageTypeUserData = chrome.storage.local;
    }

    this.initialize();
  }

  private async initialize() {
    this.loadSvgAssets();
    await this.fetchWebpageSelectors();
    this.getUserData();
    this.setupListeners();
  }

  public static extConsoleOut(msg: string | Record<string, any>) {
    if (typeof msg === 'string') {
      console.log('Steam Library Checker: ' + msg);
    } else {
      console.log('Steam Library Checker:');
      console.log(msg);
    }
  }

  private setupListeners() {
    chrome.runtime.onMessage.addListener(
      (request, _, sendResponse: (response: TabResponse) => void) => {
        if (request.message === TabMessage.REMOVE_GAME_DATA) {
          this.removeAllStorageData().then(() => {
            sendResponse({ message: 'Game data removed' });
          });
        }
      }
    );
  }

  private loadSvgAssets() {
    let parser = new DOMParser();
    this.svgAssets = {
      star: parser.parseFromString(svgStar, 'image/svg+xml').documentElement,
    };

    this.svgAssets.star.classList.add('steamchecker-star');
  }

  private async getStorageData<T extends readonly (keyof SESD_Details)[]>(
    values: T
  ): Promise<SteamcheckerExtensionSaveData<(typeof values)[number]>> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(values, (storageData) => {
        if (chrome.runtime.lastError) {
          reject(
            chrome.runtime.lastError.message ??
              'Error getting chrome.storage data'
          );
          return;
        }

        resolve(storageData as any);
      });
    });
  }

  private async setStorageData(values: {
    [key in keyof SESD_Details]?: SESD_Details[key];
  }) {
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        if (chrome.runtime.lastError) {
          reject(
            chrome.runtime.lastError.message ??
              'Error saving chrome.storage data'
          );
          return;
        }

        resolve();
      });
    });
  }

  private async removeAllStorageData() {
    let allKeys: Record<keyof SESD_Details, true> = {
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

    return this.removeStorageData(allKeys);
  }

  private async removeStorageData(keys: {
    [key in keyof SESD_Details]?: true;
  }) {
    return new Promise<void>((resolve, reject) => {
      chrome.storage.local.remove(Object.keys(keys), () => {
        if (chrome.runtime.lastError) {
          reject(
            chrome.runtime.lastError.message ??
              'Error removing chrome.storage data'
          );
          return;
        }

        SteamChecker.extConsoleOut('Game data removed.');

        resolve();
      });
    });
  }

  private getUserData() {
    this.storageTypeUserData.get(['steamid', 'id64'], (obj) => {
      this.processUserData(obj as SteamIDSettings);
    });
  }

  private async fetchOwnedGames(
    steamID: string,
    id64: boolean
  ): Promise<FoxslashResponseOwnedGames> {
    let params = new URLSearchParams({
      steamid: steamID,
    });

    if (id64) {
      params.append('id64', '1');
    }

    return fetch(
      `https://www.foxslash.com/apps/steamchecker/owned/?${params.toString()}`
    )
      .then((d) => d.json())
      .then((response: FoxslashResponseOwnedGamesWithAliases) => {
        if (response.message) {
          throw new Error(response.message);
        }

        if (!response.response) {
          throw new Error('No steam games fetched');
        }

        SteamChecker.extConsoleOut(
          `(TIME) Steam Games: ${Date.now() - this.timeStartPerformance} ms`
        );

        return response.response;
      })
      .catch((err) => {
        SteamChecker.extConsoleOut(err);

        return {
          game_count: 0,
          games: [],
        };
      });
  }

  private async fetchWishedGames(
    steamID: string,
    id64: boolean
  ): Promise<string[]> {
    let params = new URLSearchParams({
      id: steamID,
      type: id64 ? 'id64' : 'id',
    });

    return fetch(
      `https://www.foxslash.com/apps/steamchecker/wishlist/?${params.toString()}`
    )
      .then((d) => d.json())
      .then((response: FoxslashResponseWishlist) => {
        if (response.message) {
          throw new Error(response.message);
        }

        SteamChecker.extConsoleOut(
          `(TIME) Steam Wishlist: ${Date.now() - this.timeStartPerformance} ms`
        );

        return response.wishlist;
      })
      .catch((err) => {
        SteamChecker.extConsoleOut(err);

        return [];
      });
  }

  private async fetchAliases(): Promise<FoxslashResponseAliases> {
    if (!this.webpageSelectorSettings) {
      SteamChecker.extConsoleOut('Webpage selector data not loaded.');

      return {};
    }

    //get php arguments of game names
    var phpArgs: {
      type: 'all' | 'some';
      names?: string[];
    } = {
      type: 'all',
    };

    // IDEA: Possibly fix this in the future; currently doesn't work with mutation observer
    // if (this.webpageSelectorSettings.partial_aliases === true) {
    //   phpArgs.type = 'some';
    //   phpArgs.names = [];
    //   this.webpageGames.forEach((game) => {
    //     phpArgs.names!.push(game.name);
    //   });
    // }

    return fetch('https://www.foxslash.com/apps/steamchecker/aliases/', {
      method: 'POST',
      body: JSON.stringify(phpArgs),
    })
      .then((d) => d.json())
      .then((response: FoxslashResponseAliases) => {
        if (response.message) {
          SteamChecker.extConsoleOut(response.message);
          return {};
        }

        SteamChecker.extConsoleOut(
          `(TIME) Steam Aliases: ${Date.now() - this.timeStartPerformance} ms`
        );

        return response;
      })
      .catch(() => {
        SteamChecker.extConsoleOut('Unable to load aliases');

        return {};
      });
  }

  private async fetchAppList(): Promise<SteamGameBasic[]> {
    return fetch('https://www.foxslash.com/apps/steamchecker/appList.json')
      .then((d) => d.json())
      .then((response: FoxslashResponseSteamAppList) => {
        if (response.message) {
        }

        SteamChecker.extConsoleOut(
          `(TIME) Steam App List: ${Date.now() - this.timeStartPerformance} ms`
        );

        return response.applist.apps;
      })
      .catch((err) => {
        SteamChecker.extConsoleOut(err);

        return [];
      });
  }

  private async processUserData(steamIDSettings: SteamIDSettings) {
    if (!steamIDSettings.steamid) {
      SteamChecker.extConsoleOut('No SteamID Saved');
      return;
    }

    if (steamIDSettings.id64 === undefined) {
      SteamChecker.extConsoleOut('Unable to determine steamID format');
      return;
    }

    if (!this.webpageSelectorSettings) {
      SteamChecker.extConsoleOut('Webpage selector data not loaded.');

      return;
    }

    // GET WEB GAME DATA
    let hasNonObservers = false;
    this.webpageSelectorSettings.forEach((selectorSettings) => {
      if (selectorSettings.observer) {
        let mutationKeysTable = new SteamCheckerMutationListener(() => {
          this.processWebpageData();
          this.highlightGames();
        });
        mutationKeysTable.observe(selectorSettings.observer);
      } else {
        hasNonObservers = true;
      }
    });
    // process all non-observer data at the same time
    if (hasNonObservers) {
      this.processWebpageData();
    }

    this.timeStartPerformance = Date.now(); // start performance timer for fetching

    let [owned, wishlist, aliases, appList] = await Promise.all([
      this.fetchOwnedGames(steamIDSettings.steamid, steamIDSettings.id64),
      this.fetchWishedGames(steamIDSettings.steamid, steamIDSettings.id64),
      this.fetchAliases(), // TODO: Ensure webNames is set
      this.fetchAppList(),
    ]);

    let fetchedData: GameData = {
      userOwnedGames: owned,
      userWishlistedGames: wishlist,
      gameAliases: aliases,
      steamAppList: appList,
    };

    await this.processJSON(fetchedData);

    this.highlightGames();
  }

  private loadAliases(
    gameArray: string[] | SteamGame[],
    aliasArray: Record<string, string[]>
  ) {
    var addNames: Set<string> = new Set();

    Object.keys(aliasArray).forEach((appID) => {
      if (isSteamGameArray(gameArray)) {
        gameArray.some((game) => {
          if (game.appid + '' !== appID) {
            return;
          }

          // push and return true to immediately break
          aliasArray[appID]!.forEach((alias) => {
            addNames.add(alias);
          });
          return true;
        });
      } else {
        gameArray.some((gameID) => {
          if (gameID + '' !== appID) {
            return;
          }

          // push and return true to immediately break
          aliasArray[appID]!.forEach((alias) => {
            addNames.add(alias);
          });
          return true;
        });
      }
    });

    if (addNames.size === 0) {
      SteamChecker.extConsoleOut(`No aliases found for this set of games.`);
    } else {
      SteamChecker.extConsoleOut(
        `Aliases loaded: ${Array.from(addNames).join(', ')}`
      );
    }

    return addNames;
  }

  /**
   * Remove everything except alphanumeric and shrink multiple spaces
   *
   * @param title
   * @returns
   */
  private formatGameTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  private hashGames(games: string[]) {
    let stringNames = games.join(',');

    let hash = 0;
    if (stringNames.length === 0) return hash;

    for (let i = 0; i < stringNames.length; i++) {
      let chr = stringNames.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32bit integer
    }

    return hash;
  }

  private async processDataOwnedGames(
    ownedGames: SteamGame[],
    ownedHash: number | undefined,
    gameAliases: Record<string, string[]>
  ) {
    let ownedGeneratedHash = this.hashGames(
      ownedGames.map((game) => game.name)
    );

    if (ownedHash === ownedGeneratedHash) {
      this.ownedShortNames = (
        await this.getStorageData(['owned_shortnames'])
      ).owned_shortnames?.reduce((shortnames, sn) => {
        shortnames[sn] = true;
        return shortnames;
      }, {} as GameShortNames);
    }

    if (this.ownedShortNames) {
      SteamChecker.extConsoleOut(
        `Loaded ${
          Object.keys(this.ownedShortNames).length
        } owned game short names`
      );
    } else {
      this.ownedShortNames = {};

      ownedGames.forEach((game) => {
        let formattedName = this.formatGameTitle(game.name);

        this.ownedShortNames![formattedName] = true;
      });

      let gameArray = Object.keys(this.ownedShortNames);
      await this.setStorageData({
        owned_hash: ownedGeneratedHash,
        owned_shortnames: gameArray,
      });

      SteamChecker.extConsoleOut(
        `Saved ${gameArray.length} owned game short names`
      );
    }

    // load owned aliases
    this.loadAliases(ownedGames, gameAliases).forEach((alias) => {
      this.ownedShortNames![alias] = true;
    });
  }

  private async processDataWishlistGames(
    wishlistGames: string[],
    wishlistHash: number | undefined,
    gameAliases: Record<string, string[]>,
    allGames: SteamGame[]
  ) {
    let wishlistGeneratedHash = this.hashGames(wishlistGames);

    if (wishlistHash === wishlistGeneratedHash) {
      this.wishedShortNames = (
        await this.getStorageData(['wishlist_shortnames'])
      ).wishlist_shortnames?.reduce((shortnames, sn) => {
        shortnames[sn] = true;
        return shortnames;
      }, {} as GameShortNames);
    }

    if (this.wishedShortNames) {
      SteamChecker.extConsoleOut(
        `Loaded ${
          Object.keys(this.wishedShortNames).length
        } wishlist game short names`
      );
    } else {
      this.wishedShortNames = {};

      wishlistGames.forEach((game) => {
        let foundGame = allGames.find((app) => {
          if (game === app.appid + '') {
            return true;
          }

          return false;
        });

        if (!foundGame) return;

        let formattedName = this.formatGameTitle(foundGame.name);
        this.wishedShortNames![formattedName] = true;
      });

      let gameArray = Object.keys(this.wishedShortNames);
      await this.setStorageData({
        wishlist_hash: wishlistGeneratedHash,
        wishlist_shortnames: gameArray,
      });

      SteamChecker.extConsoleOut(
        `Saved ${gameArray.length} wishlist game short names`
      );
    }

    // load wishlist aliases
    this.loadAliases(wishlistGames, gameAliases).forEach((alias) => {
      this.wishedShortNames![alias] = true;
    });
  }

  private async processJSON(data: GameData) {
    SteamChecker.extConsoleOut('Loaded all data.');

    let storageGameData = await this.getStorageData([
      'numgames',
      'shortnames',
      'owned_hash',
      'wishlist_hash',
    ]);

    // remove old storage data if it's set
    if (storageGameData.numgames !== undefined) {
      this.removeAllStorageData();

      storageGameData.owned_hash = undefined;
      storageGameData.wishlist_hash = undefined;
    }

    // check new hashes against previous hashes
    // refresh data if changed
    await Promise.all([
      this.processDataOwnedGames(
        data.userOwnedGames.games,
        storageGameData.owned_hash,
        data.gameAliases
      ),

      this.processDataWishlistGames(
        data.userWishlistedGames,
        storageGameData.wishlist_hash,
        data.gameAliases,
        data.steamAppList
      ),
    ]);
  }

  private setElementStyle(
    element: HTMLElement,
    extraStyles: Partial<CSSStyleDeclaration>
  ) {
    Object.assign(element.style, extraStyles);
  }

  private addClassToElements(
    gameElement: SteamcheckerFoundGameElement,
    classType: 'owned' | 'wished'
  ) {
    if (!this.webpageSelectorSettings) {
      SteamChecker.extConsoleOut('Webpage selector data not loaded.');

      return;
    }

    // FIXME: selectorSettings and figure out which settings are needed
    // store selectorSettings in this.webpageGames array?

    let highlightElement: HTMLElement = gameElement.wrapper;
    if (gameElement.selectorSettings.highlight) {
      let checkingElement = gameElement.wrapper.querySelector<HTMLElement>(
        gameElement.selectorSettings.highlight
      );

      if (!checkingElement) {
        SteamChecker.extConsoleOut('Webpage selector for highlight not found.');

        return;
      }

      highlightElement = checkingElement;
    }

    highlightElement.classList.add(
      `steamchecker-${classType}${gameElement.selectorSettings.class_type}`
    );

    if (gameElement.selectorSettings.star && this.svgAssets) {
      let starElement = gameElement.wrapper.querySelector(
        gameElement.selectorSettings.star
      );
      if (starElement) {
        starElement.append(this.svgAssets.star);
      }
    }

    // set any extra necessary styles
    if (gameElement.selectorSettings.extra_styles) {
      Object.keys(gameElement.selectorSettings.extra_styles).forEach(
        (selector) => {
          if (selector === ':scope') {
            this.setElementStyle(
              gameElement.wrapper,
              gameElement.selectorSettings.extra_styles![selector]
            );
          } else {
            gameElement.wrapper
              .querySelectorAll<HTMLElement>(selector)
              .forEach((selectedElem) => {
                this.setElementStyle(
                  selectedElem,
                  gameElement.selectorSettings.extra_styles![selector]
                );
              });
          }
        }
      );
    }
  }

  //show owned and wishlisted games
  private highlightGames() {
    if (!this.ownedShortNames || !this.wishedShortNames) {
      SteamChecker.extConsoleOut(
        `Error highlighting games; no owned or wishlisted games`
      );

      return;
    }

    this.timeStartPerformance = Date.now();

    // check if names are the same
    this.webpageGames.forEach((foundGameElement) => {
      if (this.ownedShortNames![foundGameElement.name]) {
        this.addClassToElements(foundGameElement, 'owned');
      }

      if (this.wishedShortNames![foundGameElement.name]) {
        this.addClassToElements(foundGameElement, 'wished');
      }
    });

    SteamChecker.extConsoleOut(
      `(TIME) Game Checking on Page: ${
        Date.now() - this.timeStartPerformance
      } ms`
    );
  }

  private async fetchWebpageSelectors(): Promise<FoxslashResponseModeWebpageSelectors> {
    let json: FoxslashResponseModeWebpageSelectors = {};

    try {
      let response = await fetch(
        `https://www.foxslash.com/apps/steamchecker/selectors/`
      );
      json = await response.json();

      let foundPageRegex = Object.keys(json).find((pageRegEx) => {
        if (window.location.pathname.match(pageRegEx)) {
          return true;
        }

        return false;
      });

      if (!foundPageRegex) {
        throw new Error('Not yet scanning on this URL pattern');
      }

      this.webpageSelectorSettings = json[foundPageRegex];

      SteamChecker.extConsoleOut('Fetched game selectors');
    } catch (err: any) {
      SteamChecker.extConsoleOut(err);
    }

    return json;
  }

  private processWebpageData() {
    if (!this.webpageSelectorSettings) {
      SteamChecker.extConsoleOut('Webpage selector data not loaded.');

      return;
    }

    this.timeStartPerformance = Date.now();

    this.webpageGames = [];

    this.webpageSelectorSettings.forEach((selectorSettings) => {
      let foundGameWrappers = document.querySelectorAll<HTMLElement>(
        selectorSettings.game_wrapper
      );

      if (foundGameWrappers.length === 0) {
        SteamChecker.extConsoleOut('No games found on this page');

        return;
      }

      foundGameWrappers.forEach((wrapper) => {
        let titleElem = wrapper.querySelector<HTMLElement>(
          selectorSettings.title
        );
        if (!titleElem) return;

        let gameTitle: string | null | undefined;

        if (selectorSettings.title_attribute) {
          gameTitle = titleElem
            .getAttribute(selectorSettings.title_attribute)
            ?.trim();
        } else {
          gameTitle = titleElem.textContent?.trim();
        }

        if (!gameTitle) return;

        //this.machineNames.push(gameTitle.replace(/(["'])/, '\\$1'));
        this.webpageGames.push({
          name: this.formatGameTitle(gameTitle),
          wrapper: wrapper,
          selectorSettings: selectorSettings,
        });
      });
    });

    SteamChecker.extConsoleOut(
      `Games found on page: ${this.webpageGames.map((g) => g.name).join(', ')}`
    );

    SteamChecker.extConsoleOut(
      `(TIME) Webpage Processing: ${Date.now() - this.timeStartPerformance}ms`
    );
  }
}

(() => {
  new SteamChecker();
})();
