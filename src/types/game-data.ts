import type { SteamGame } from './steam-game';

export type GameData = {
  userOwnedGames: {
    game_count: number;
    games: SteamGame[];
  };
  /** Array of Steam appIDs */
  userWishlistedGames: string[];
  gameAliases: Record<string, string[]>;
  steamAppList: SteamGame[];
};

export type GameShortNames = Record<string, true>;
