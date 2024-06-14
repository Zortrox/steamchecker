// content.js

import type {
  FoxslashResponseAliases,
  FoxslashResponseModeWebpageSelectors,
  FoxslashResponseOwnedGames,
  FoxslashResponseOwnedGamesWithAliases,
  FoxslashResponseSteamAppList,
  FoxslashResponseWishlist,
  SESD_Details,
  SteamcheckerExtensionSaveData,
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
  private timeout: Timer | undefined;

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

    this.timeout = setTimeout(() => {
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

  private webpageSelectorSettings: SteamcheckerWebpageSelectors | undefined;

  // arrays for games currently on webpage
  private webpageGames: {
    name: string;
    wrapper: HTMLElement;
  }[] = [];
  // private machineNames: string[] = [];

  // arrays for game names + aliases
  private ownedShortNames: GameShortNames | undefined;
  private wishedShortNames: GameShortNames | undefined;

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
      (request, sender, sendResponse: (response: TabResponse) => void) => {
        if (request.message === TabMessage.REMOVE_GAME_DATA) {
          this.removeAllStorageData().then(() => {
            sendResponse({ message: 'Game data removed' });
          });
        }
      }
    );
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
      `https://www.foxslash.com/apps/steamchecker/?${params.toString()}`
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
      `https://www.foxslash.com/apps/steamchecker/wishlist.php?${params.toString()}`
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

    if (this.webpageSelectorSettings.partial_aliases === true) {
      phpArgs.type = 'some';
      phpArgs.names = [];
      this.webpageGames.forEach((game) => {
        phpArgs.names!.push(game.name);
      });
    }

    return fetch('https://www.foxslash.com/apps/steamchecker/aliases.php', {
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
    let mutationKeysTable = new SteamCheckerMutationListener(async () => {
      this.processWebpageData();
      this.highlightGames();
    });
    if (this.webpageSelectorSettings.observer) {
      mutationKeysTable.observe(this.webpageSelectorSettings.observer);
    } else {
      this.processWebpageData();
    }

    this.timeStartPerformance = Date.now();

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

    SteamChecker.extConsoleOut('Aliases loaded');
    SteamChecker.extConsoleOut(addNames);

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
        `Loaded ${Object.keys(this.ownedShortNames)} owned game short names`
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
    }

    if (this.wishedShortNames) {
      SteamChecker.extConsoleOut(
        `Loaded ${Object.keys(this.wishedShortNames)} wishlist game short names`
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
    SteamChecker.extConsoleOut(data);

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

    this.highlightGames();
  }

  private addClassToElements(
    gameWrapperElement: HTMLElement,
    classType: 'owned' | 'wished'
  ) {
    if (!this.webpageSelectorSettings) {
      SteamChecker.extConsoleOut('Webpage selector data not loaded.');

      return;
    }

    let highlightElement: HTMLElement = gameWrapperElement;
    if (this.webpageSelectorSettings.highlight) {
      let checkingElement = gameWrapperElement.querySelector<HTMLElement>(
        this.webpageSelectorSettings.highlight
      );

      if (!checkingElement) {
        SteamChecker.extConsoleOut('Webpage selector for highlight not found.');

        return;
      }

      highlightElement = checkingElement;
    }

    highlightElement.classList.add(
      `steamchecker-${classType}${this.webpageSelectorSettings.class_type}`
    );

    // if (this.currentMode == HighlightMode.BUNDLE) {
    //   $('[' + gamenameAttr + "='" + machineNames[webIndex] + "']")
    //     .closest('.dd-image-box')
    //     .addClass(addedClass);
    // } else if (this.currentMode == HighlightMode.KEYS) {
    //   var keyElement = $(
    //     "td.game-name h4[title='" + machineNames[webIndex] + "']"
    //   ).closest('tr');
    //   if (addedClass == 'ownedGame') {
    //     keyElement.addClass('ownedKey');
    //     keyElement
    //       .find('.hb-gift')
    //       .append(
    //         '<img src="' +
    //           chrome.extension.getURL('star.png') +
    //           '" class="star"/>'
    //       );
    //   } else {
    //     keyElement.addClass('wishedKey');
    //   }
    // } else if (
    //   this.currentMode == HighlightMode.STORE ||
    //   this.currentMode == HighlightMode.SEARCH
    // ) {
    //   $('.entity-block-container')
    //     .filter(function () {
    //       return $('.entity-title', this).text() == machineNames[webIndex];
    //     })
    //     .addClass(addedClass);
    //   $(
    //     ".entity-container .entity-title[title='" +
    //       machineNames[webIndex] +
    //       "']"
    //   )
    //     .closest('.entity-container')
    //     .addClass(addedClass);
    // } else if (this.currentMode == HighlightMode.CHOICE) {
    //   $('.content-choice')
    //     .filter(function () {
    //       return (
    //         $('.content-choice-title', this).text() == machineNames[webIndex]
    //       );
    //     })
    //     .addClass(addedClass);
    // }
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
        this.addClassToElements(foundGameElement.wrapper, 'owned');
      }

      if (this.wishedShortNames![foundGameElement.name]) {
        this.addClassToElements(foundGameElement.wrapper, 'wished');
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

    let foundGameWrappers = document.querySelectorAll<HTMLElement>(
      this.webpageSelectorSettings.game_wrapper
    );

    if (foundGameWrappers.length === 0) {
      SteamChecker.extConsoleOut('No games found on this page');

      return;
    }

    foundGameWrappers.forEach((wrapper) => {
      if (!this.webpageSelectorSettings) {
        SteamChecker.extConsoleOut('Webpage selector data not loaded.');

        return;
      }

      let titleElem = wrapper.querySelector<HTMLElement>(
        this.webpageSelectorSettings.title
      );
      if (!titleElem) return;

      let gameTitle: string | null;

      if (this.webpageSelectorSettings.title_attribute) {
        gameTitle = titleElem.getAttribute(
          this.webpageSelectorSettings.title_attribute
        );
      } else {
        gameTitle = titleElem.textContent;
      }

      if (!gameTitle) return;

      //this.machineNames.push(gameTitle.replace(/(["'])/, '\\$1'));
      this.webpageGames.push({
        name: this.formatGameTitle(gameTitle),
        wrapper: wrapper,
      });
    });

    SteamChecker.extConsoleOut(
      `(TIME) Webpage Processing: ${Date.now() - this.timeStartPerformance}ms`
    );

    // if (this.currentMode == HighlightMode.BUNDLE) {
    //   //get the Humble Bundle game machine names
    //   $('.dd-image-box-figure[' + gamenameAttr + ']').each(function () {
    //     //$(".dd-image-box-caption").each(function() {
    //     var title = $(this).attr(gamenameAttr);
    //     //var title = $(this).text();

    //     if (title != '') {
    //       machineNames.push(title.replace(/(["'])/, '\\$1'));
    //       webNames.push(this.formatGameTitle(title));
    //       htmlElements.push($(this).closest('.dd-image-box'));
    //     }
    //   });
    // } else if (this.currentMode == HighlightMode.KEYS) {
    //   $('.unredeemed-keys-table tr .game-name h4').each(function () {
    //     var title = $(this).attr('title');

    //     if (title != '') {
    //       machineNames.push(title.replace(/(["'])/, '\\$1'));
    //       webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
    //     }
    //   });
    // } else if (
    //   this.currentMode == HighlightMode.STORE ||
    //   this.currentMode == HighlightMode.SEARCH
    // ) {
    //   $(
    //     '.entity-block-container .entity-title, .entity-container .entity-title'
    //   ).each(function () {
    //     var title = $(this).attr('title');
    //     if (!title || title == '') {
    //       title = $(this).text();
    //     }

    //     if (title != '') {
    //       machineNames.push(title.replace(/(["'])/, '\\$1'));
    //       webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
    //       htmlElements.push(
    //         $(this).closest('.entity-block-container, .entity-container')
    //       );
    //     }
    //   });
    // } else if (this.currentMode == HighlightMode.CHOICE) {
    //   $('.content-choice .content-choice-title').each(function () {
    //     var title = $(this).text();

    //     if (title != '') {
    //       machineNames.push(title.replace(/(["'])/, '\\$1'));
    //       webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
    //       htmlElements.push($(this).closest('.content-choice'));
    //     }
    //   });
    // } else {
    //   SteamChecker.extConsoleOut('Not yet scanning on this URL');
    // }
  }
}

(() => {
  new SteamChecker();

  // TODO: Map these to the /selectors/ request

  // let page = window.location.pathname;
  // if (page.startsWith('/books') || page.startsWith('/monthly')) {
  //   SteamChecker.extConsoleOut('Not yet scanning on this URL');
  //   return;
  // }

  // if (page.startsWith('/home/keys')) {
  //   new SteamChecker(HighlightMode.KEYS);
  // } else if (page.startsWith('/store')) {
  //   new SteamChecker(HighlightMode.STORE);
  // } else if (page.startsWith('/store/search')) {
  //   new SteamChecker(HighlightMode.SEARCH);
  // } else if (page.startsWith('/subscription/home')) {
  //   new SteamChecker(HighlightMode.CHOICE);
  // }
})();
