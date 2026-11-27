import type { FoxslashAccount } from "./auth";
import type { SteamGame, SteamGameBasic } from "../types/steam-game";

/**
 * Base URL of the foxslash SteamChecker API. Override at build time with
 * `VITE_FOXSLASH_API_URL` (e.g. `http://localhost:8003/api/steamchecker` for a
 * local foxslash server).
 */
export const FOXSLASH_API_URL: string = (
  import.meta.env.VITE_FOXSLASH_API_URL ?? "https://www.foxslash.com/api/steamchecker"
).replace(/\/+$/, "");

export type OwnedGamesResponse = {
  steam_id: string;
  game_count: number;
  games: SteamGame[];
};

export type WishlistResponse = {
  steam_id: string;
  appids: number[];
};

/** Alternate titles keyed by Steam appid. */
export type AliasesResponse = Record<string, string[]>;

export type AppListResponse = {
  apps: SteamGameBasic[];
};

export type TokenResponse = {
  token: string;
  account: FoxslashAccount;
};

export class FoxslashApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type RequestOptions = {
  token?: string;
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${FOXSLASH_API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : `HTTP ${response.status}`;
    throw new FoxslashApiError(message, response.status);
  }

  return body as T;
}

// Public data ---------------------------------------------------------------

export function fetchAliases() {
  return request<AliasesResponse>("/aliases");
}

export function fetchAppList() {
  return request<AppListResponse>("/apps");
}

// Sign-in and the signed-in account ------------------------------------------

export function exchangeSignInCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  deviceName: string;
}) {
  return request<TokenResponse>("/token", {
    method: "POST",
    body: {
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
      device_name: params.deviceName,
    },
  });
}

export function revokeToken(token: string) {
  return request<void>("/token", { method: "DELETE", token });
}

export function fetchAccount(token: string) {
  return request<FoxslashAccount>("/me", { token });
}

export function fetchMyOwnedGames(token: string) {
  return request<OwnedGamesResponse>("/me/owned", { token });
}

export function fetchMyWishlist(token: string) {
  return request<WishlistResponse>("/me/wishlist", { token });
}
