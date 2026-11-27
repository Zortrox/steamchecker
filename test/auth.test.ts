import { describe, expect, it } from "vitest";

import {
  SignInError,
  base64Url,
  buildConnectUrl,
  codeChallenge,
  parseConnectRedirect,
  randomString,
} from "../src/lib/auth";

describe("sign-in helpers", () => {
  it("computes the RFC 7636 example S256 challenge", async () => {
    // https://datatracker.ietf.org/doc/html/rfc7636#appendix-B
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("makes url-safe random strings", () => {
    const value = randomString(48);
    expect(value).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(randomString()).not.toBe(randomString());
    expect(base64Url(new Uint8Array([251, 255]))).toBe("-_8");
  });

  it("builds the connect URL", () => {
    const url = new URL(
      buildConnectUrl({ redirectUri: "https://abc.chromiumapp.org/", state: "s", challenge: "c" }),
    );
    expect(url.origin + url.pathname).toBe("https://www.foxslash.com/extension/connect");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      redirect_uri: "https://abc.chromiumapp.org/",
      state: "s",
      code_challenge: "c",
      code_challenge_method: "S256",
    });
  });

  it("reads the code and checks state", () => {
    expect(parseConnectRedirect("https://abc.chromiumapp.org/?code=xyz&state=s", "s")).toBe("xyz");
    expect(() => parseConnectRedirect("https://abc.chromiumapp.org/?code=xyz&state=other", "s")).toThrow(
      SignInError,
    );
    expect(() =>
      parseConnectRedirect("https://abc.chromiumapp.org/?error=access_denied&state=s", "s"),
    ).toThrow(/cancelled/);
    expect(() => parseConnectRedirect("https://abc.chromiumapp.org/?state=s", "s")).toThrow(/code/);
  });
});
