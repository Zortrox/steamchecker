import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FOXSLASH_API_URL,
  FoxslashApiError,
  exchangeSignInCode,
  fetchAliases,
  fetchAppList,
  fetchMyOwnedGames,
  fetchMyWishlist,
  revokeToken,
} from "../src/lib/foxslash-api";

function mockFetch(status: number, body?: unknown) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("foxslash API client", () => {
  it("calls the public endpoints without a token", async () => {
    const aliases = mockFetch(200, { "220": ["half life 2"] });
    await fetchAliases();
    expect(aliases.mock.calls[0]![0]).toBe(`${FOXSLASH_API_URL}/aliases`);
    expect(new Headers(aliases.mock.calls[0]![1]!.headers).has("Authorization")).toBe(false);

    const apps = mockFetch(200, { apps: [{ appid: 220, name: "Half-Life 2" }] });
    expect((await fetchAppList()).apps).toHaveLength(1);
    expect(apps.mock.calls[0]![0]).toBe(`${FOXSLASH_API_URL}/apps`);
  });

  it("sends the bearer token to /me endpoints", async () => {
    const owned = mockFetch(200, { steam_id: "1", game_count: 0, games: [] });
    await fetchMyOwnedGames("tok");
    expect(owned.mock.calls[0]![0]).toBe(`${FOXSLASH_API_URL}/me/owned`);
    expect(new Headers(owned.mock.calls[0]![1]!.headers).get("Authorization")).toBe(
      "Bearer tok",
    );

    const wishlist = mockFetch(200, { steam_id: "1", appids: [10, 20] });
    expect((await fetchMyWishlist("tok")).appids).toEqual([10, 20]);
    expect(wishlist.mock.calls[0]![0]).toBe(`${FOXSLASH_API_URL}/me/wishlist`);
  });

  it("exchanges a sign-in code and revokes tokens", async () => {
    const exchange = mockFetch(200, { token: "t", account: { name: "A" } });
    await exchangeSignInCode({
      code: "c",
      codeVerifier: "v",
      redirectUri: "https://x.chromiumapp.org/",
      deviceName: "SteamChecker (Chrome)",
    });
    const [url, init] = exchange.mock.calls[0]!;
    expect(url).toBe(`${FOXSLASH_API_URL}/token`);
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({
      code: "c",
      code_verifier: "v",
      redirect_uri: "https://x.chromiumapp.org/",
      device_name: "SteamChecker (Chrome)",
    });

    const revoke = mockFetch(204);
    await revokeToken("t");
    expect(revoke.mock.calls[0]![1]!.method).toBe("DELETE");
  });

  it("turns {message} error bodies into FoxslashApiError", async () => {
    mockFetch(401, { message: "Unauthenticated." });
    const error: unknown = await fetchMyOwnedGames("bad").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoxslashApiError);
    expect((error as FoxslashApiError).status).toBe(401);
    expect((error as FoxslashApiError).message).toBe("Unauthenticated.");
  });
});
