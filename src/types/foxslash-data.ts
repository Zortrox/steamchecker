import type { SteamGame, SteamGameBasic } from './steam-game';

export type FoxslashResponseWishlist = {
  wishlist: string[];

  message?: string;
};

export type FoxslashResponseAliases = Record<string, string[]>;

export type FoxslashResponseOwnedGames = {
  game_count: number;
  games: SteamGame[];
};
export type FoxslashResponseOwnedGamesWithAliases = {
  aliases: {};
  response: FoxslashResponseOwnedGames;

  message?: string;
};

export type FoxslashResponseSteamAppList = {
  applist: {
    apps: SteamGameBasic[];
  };

  message?: string;
};

export type SteamcheckerWebpageSelectors = {
  /** If not fetching all aliases */
  partial_aliases: boolean;

  /** Selector of parent element if the system uses observers
   * rather than a one-time scan */
  observer: string | null;

  /** Selector for wrapper for each game (e.g. `li` or `tr`) */
  game_wrapper: string;

  /** Title element with optional `title_attribute` attribute if
   * the title is stored there */
  title: string;
  title_attribute: string | null;

  /** Which element inside the `game_wrapper` to add
   * the highlight/gray-out class. If `null`, uses the
   * `game_wrapper` element. */
  highlight: string | null;

  /** Which element inside the `game_wrapper` to add the rotating star icon */
  star: string | null;

  /** appended after the classname. e.g. `"Game"` or `"Key"` */
  class_type: string;
};
export type FoxslashResponseModeWebpageSelectors = Record<
  string,
  SteamcheckerWebpageSelectors
>;

// save data types
export type SESD_Details = {
  // old data
  // ===================
  /** @deprecated */
  numgames: number;
  /** @deprecated */
  shortnames: string[];
  /** @deprecated */
  aliases: string[];

  // new data
  // ===================
  wishlist_hash: number;
  wishlist_shortnames: string[];

  owned_hash: number;
  owned_shortnames: string[];
};

export type SteamcheckerExtensionSaveData<T extends keyof SESD_Details> = {
  [key in T]?: SESD_Details[key];
};
