/**
 * Background script (service worker in Chrome, event page in Firefox). Owns
 * the foxslash token: it runs the sign-in window, keeps the token in
 * `chrome.storage.local`, and makes the signed-in API calls for the content
 * script and popup. See docs/sign-in.md.
 */
import {
  AUTH_STORAGE_KEY,
  SignInError,
  buildConnectUrl,
  codeChallenge,
  parseConnectRedirect,
  randomString,
  type StoredAuth,
} from "./lib/auth";
import {
  FoxslashApiError,
  exchangeSignInCode,
  fetchAccount,
  fetchMyOwnedGames,
  fetchMyWishlist,
  revokeToken,
} from "./lib/foxslash-api";
import type {
  AccountResponse,
  BackgroundRequest,
  SignInResponse,
  UserGamesResponse,
} from "./types/messages";

const isFirefox = navigator.userAgent.includes("Firefox");

async function readAuth(): Promise<StoredAuth | undefined> {
  const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return stored[AUTH_STORAGE_KEY] as StoredAuth | undefined;
}

async function clearAuth() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function signIn(): Promise<SignInResponse> {
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    const state = randomString();
    const verifier = randomString(48);

    const redirectedTo = await chrome.identity.launchWebAuthFlow({
      url: buildConnectUrl({
        redirectUri,
        state,
        challenge: await codeChallenge(verifier),
      }),
      interactive: true,
    });
    if (!redirectedTo) throw new SignInError("Sign-in window closed.");

    const code = parseConnectRedirect(redirectedTo, state);
    const { token, account } = await exchangeSignInCode({
      code,
      codeVerifier: verifier,
      redirectUri,
      deviceName: `SteamChecker (${isFirefox ? "Firefox" : "Chrome"})`,
    });

    const auth: StoredAuth = { token, account, signed_in_at: Date.now() };
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth });
    return { ok: true, account };
  } catch (err) {
    console.warn("SteamChecker: sign-in failed", err);
    if (errorMessage(err).includes("could not be loaded")) {
      // foxslash answers 400 to a redirect URL it doesn't allowlist, which is
      // what an unpacked store build (random extension ID) runs into.
      console.warn(
        `SteamChecker: foxslash may not allow ${chrome.identity.getRedirectURL()}; ` +
          "load dist-unpacked/ (fixed dev ID) or add it to STEAMCHECKER_REDIRECT_URIS.",
      );
      return { ok: false, error: "Couldn't open the foxslash sign-in page. Try again later." };
    }
    return { ok: false, error: errorMessage(err) };
  }
}

async function signOut() {
  const auth = await readAuth();
  await clearAuth();
  if (auth) {
    // best effort: the token is already forgotten locally
    await revokeToken(auth.token).catch(() => undefined);
  }
}

async function getAccount(): Promise<AccountResponse> {
  const auth = await readAuth();
  if (!auth) return { account: null };

  try {
    const account = await fetchAccount(auth.token);
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: { ...auth, account } });
    return { account };
  } catch (err) {
    if (err instanceof FoxslashApiError && err.status === 401) {
      await clearAuth();
      return { account: null };
    }
    // offline or server trouble: show what we had
    return { account: auth.account };
  }
}

async function getUserGames(): Promise<UserGamesResponse> {
  const auth = await readAuth();
  if (!auth) return { status: "signed-out" };

  const problems: string[] = [];
  const settle = async <T>(label: string, call: Promise<T>): Promise<T | null> => {
    try {
      return await call;
    } catch (err) {
      if (err instanceof FoxslashApiError && err.status === 401) throw err;
      problems.push(`${label}: ${errorMessage(err)}`);
      return null;
    }
  };

  try {
    const [owned, wishlist] = await Promise.all([
      settle("owned games", fetchMyOwnedGames(auth.token)),
      settle("wishlist", fetchMyWishlist(auth.token)),
    ]);
    return { status: "ok", owned, wishlist, problems };
  } catch (err) {
    if (err instanceof FoxslashApiError && err.status === 401) {
      await clearAuth();
      return { status: "signed-out" };
    }
    return { status: "error", error: errorMessage(err) };
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  const handlers: Record<BackgroundRequest["type"], () => Promise<unknown>> = {
    signIn,
    signOut,
    getAccount,
    getUserGames,
  };
  const handler = handlers[message?.type];
  if (!handler) return undefined;

  handler().then(sendResponse, (err) => sendResponse({ error: errorMessage(err) }));
  return true; // keep the channel open for the async response
});

// Versions before sign-in kept a pasted SteamID in sync storage; drop it.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync?.remove(["steamid", "id64"]).catch(() => undefined);
});

// Handy when adding a development build to foxslash's redirect allowlist.
console.info("SteamChecker sign-in redirect URL:", chrome.identity.getRedirectURL());
