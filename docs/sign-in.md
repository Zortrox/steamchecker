# Signing in to foxslash (server contract)

Implemented in foxslash (local) as of 2026-11-26; extension side in
`src/background.ts` and `src/lib/auth.ts`.

The extension no longer takes a pasted SteamID. The user signs in to their
foxslash account, with Steam or email and password (whatever foxslash's login
page offers), and the extension gets an API token for that account. Owned games
and the wishlist come from the Steam account linked to it.

This is not a full OAuth server. It is a one-time code handoff on top of
foxslash's existing login and Sanctum tokens, with PKCE so that a code caught
in transit is useless without the verifier only the extension holds.

## Flow

1. The user clicks **Sign in** in the popup. The extension's background script
   creates a random `state` and a PKCE `code_verifier`, and calls
   `identity.launchWebAuthFlow` (Chrome and Firefox) on:

   ```
   GET https://foxslash.com/extension/connect
       ?redirect_uri=<identity.getRedirectURL()>
       &state=<random>
       &code_challenge=<base64url(sha256(code_verifier))>
       &code_challenge_method=S256
   ```

   The browser opens this in a sign-in window that shares the browser's cookies,
   so a user already signed in to foxslash only sees step 3.

2. `/extension/connect` is a normal web route behind `auth`. A signed-out user
   goes through the usual login page (Steam button or email and password) and
   comes back to the same URL.

3. If the account has no linked Steam account, the page asks the user to link
   one and then returns to `/extension/connect`. Otherwise it shows a consent
   page: "Connect SteamChecker to your foxslash account" with the linked Steam
   name and avatar, and Allow / Cancel.

4. **Allow**: foxslash stores a one-time code (random, at least 32 bytes)
   bound to the user, `redirect_uri` and `code_challenge`, valid for 60 seconds
   and single use. It then redirects (302) to:

   ```
   <redirect_uri>?code=<code>&state=<state>
   ```

   **Cancel**: redirect to `<redirect_uri>?error=access_denied&state=<state>`.

5. The extension checks `state`, then exchanges the code:

   ```
   POST https://foxslash.com/api/steamchecker/token
   Content-Type: application/json

   {"code": "...", "code_verifier": "...", "redirect_uri": "...", "device_name": "SteamChecker (Chrome)"}
   ```

   foxslash checks that the code exists, is unused and unexpired, that
   `redirect_uri` matches, and that `base64url(sha256(code_verifier))` equals
   the stored challenge. It deletes the code, then creates a Sanctum personal
   access token for the user named `device_name` with the single ability
   `steamchecker`, and returns:

   ```json
   {
     "token": "1|abc...",
     "account": { "name": "Zortrox", "steam_id": "7656...", "steam_name": "...", "avatar_url": "https://..." }
   }
   ```

   Any failure returns `400 {"message": "..."}`.

## redirect_uri allowlist

`identity.getRedirectURL()` is fixed per extension ID. foxslash only redirects
to exact matches from `STEAMCHECKER_REDIRECT_URIS` (comma separated, trailing
slash included) and answers anything else with a plain 400.

| Build | redirect_uri |
| --- | --- |
| Chrome, any non-store build (`dev`, `build:local`, `build:e2e`) | `https://ceggehhaldhcfgpgkfjlmppeagigocck.chromiumapp.org/` |
| Chrome Web Store | `https://<store extension id>.chromiumapp.org/` |
| Edge Add-ons | `https://<Edge extension id>.chromiumapp.org/` |
| Firefox, dev and AMO | `https://5eae38a3832e255a62f0aa2e16bf8632bc085ffd.extensions.allizom.org/` (sha1 of `@steamchecker`) |

Non-store builds get a fixed ID from the public `key` in `manifest.config.ts`.
The background console logs the redirect URL on start.

## Authenticated API

All requests send `Authorization: Bearer <token>` and need the `steamchecker`
ability. A `401` means the token was revoked or expired; the extension then
forgets it and shows "Sign in" again.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/steamchecker/me` | `{"name", "steam_id", "steam_name", "avatar_url"}` |
| GET | `/api/steamchecker/me/owned` | `{"steam_id", "game_count", "games": [{"appid", "name", ...}]}` |
| GET | `/api/steamchecker/me/wishlist` | `{"steam_id", "appids": [int]}` |
| DELETE | `/api/steamchecker/token` | `204`, revokes the token used for the request (sign out) |

`/me/owned` and `/me/wishlist` return the same shapes and errors as the
current `/profiles/{profile}/*` endpoints (`404 {message}` for a private
profile, `502` when Steam is down), plus `409 {message}` when the account has no
linked Steam account. `/aliases`, `/apps` and `/config/v2` stay public.

Users should be able to see and revoke these tokens from their foxslash
account settings, the same way as other Sanctum tokens.

CORS: the extension calls these from its background script, which has host
permission for `https://foxslash.com/api/steamchecker/*`, so CORS
doesn't block them. The public endpoints keep `Access-Control-Allow-Origin: *`
because the content script still fetches the page config itself.
