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
