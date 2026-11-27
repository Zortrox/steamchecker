/**
 * Helpers for the foxslash sign-in handoff (see docs/sign-in.md). Pure
 * functions so they can be unit tested; the browser calls live in
 * `src/background.ts`.
 */

export const FOXSLASH_CONNECT_URL: string =
  import.meta.env.VITE_FOXSLASH_CONNECT_URL ?? "https://www.foxslash.com/extension/connect";

export type FoxslashAccount = {
  name: string;
  steam_id: string | null;
  steam_name: string | null;
  avatar_url: string | null;
};

/** What the extension keeps in `chrome.storage.local` under `AUTH_STORAGE_KEY`. */
export type StoredAuth = {
  token: string;
  account: FoxslashAccount;
  signed_in_at: number;
};

export const AUTH_STORAGE_KEY = "foxslash_auth";

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** PKCE S256 challenge for a verifier. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function buildConnectUrl(params: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(FOXSLASH_CONNECT_URL);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export class SignInError extends Error {}

/** Read the code from the URL foxslash redirected back to, checking `state`. */
export function parseConnectRedirect(redirectedTo: string, expectedState: string): string {
  const url = new URL(redirectedTo);
  const params = url.searchParams;

  if (params.get("state") !== expectedState) {
    throw new SignInError("Sign-in response did not match this request.");
  }

  const error = params.get("error");
  if (error === "access_denied") throw new SignInError("Sign-in was cancelled.");
  if (error) throw new SignInError(`foxslash returned an error: ${error}`);

  const code = params.get("code");
  if (!code) throw new SignInError("foxslash did not return a sign-in code.");
  return code;
}
