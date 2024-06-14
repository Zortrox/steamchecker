export type SteamGameBasic = {
  appid: number;
  name: string;
};

export type SteamGame = SteamGameBasic & {
  has_community_visible_stats?: boolean;
  img_icon_url?: string;
  playtime_deck_forever?: number;
  playtime_disconnected?: number;
  playtime_forever?: number;
  playtime_linux_forever?: number;
  playtime_mac_forever?: number;
  playtime_windows_forever?: number;
  rtime_last_played?: number;
};

export function isSteamGameArray(
  gameArray: string[] | SteamGame[]
): gameArray is SteamGame[] {
  return typeof (gameArray as SteamGame[])[0] !== 'string';
}
