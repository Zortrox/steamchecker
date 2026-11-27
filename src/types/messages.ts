import type { FoxslashAccount } from "../lib/auth";
import type { OwnedGamesResponse, WishlistResponse } from "../lib/foxslash-api";

/** Messages the popup sends to the content script in the active tab. */
export const enum TabMessage {
  REMOVE_GAME_DATA = "removeGameData",
}

export type TabResponse = {
  message: string;
};

/** Messages handled by the background script, which holds the foxslash token. */
export type BackgroundRequest =
  | { type: "signIn" }
  | { type: "signOut" }
  | { type: "getAccount" }
  | { type: "getUserGames" };

export type SignInResponse =
  | { ok: true; account: FoxslashAccount }
  | { ok: false; error: string };

export type AccountResponse = { account: FoxslashAccount | null };

/** Owned games and wishlist for the signed-in account. */
export type UserGamesResponse =
  | { status: "signed-out" }
  | { status: "error"; error: string }
  | {
      status: "ok";
      owned: OwnedGamesResponse | null;
      wishlist: WishlistResponse | null;
      /** Per-request problems (private library, Steam down) to log. */
      problems: string[];
    };

export function sendToBackground(message: { type: "signIn" }): Promise<SignInResponse>;
export function sendToBackground(message: { type: "signOut" }): Promise<void>;
export function sendToBackground(message: { type: "getAccount" }): Promise<AccountResponse>;
export function sendToBackground(message: {
  type: "getUserGames";
}): Promise<UserGamesResponse>;
export function sendToBackground(message: BackgroundRequest): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}
