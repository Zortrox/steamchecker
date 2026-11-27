# SteamChecker

Browser extension for Chrome, Firefox and Edge that grays out Steam games you
already own and highlights wishlisted ones on Humble Bundle.

## Development

```bash
bun install
bun run dev      # load dist/ as an unpacked extension
bun run test
bun run build    # extension-chrome.zip and extension-firefox.zip
bun run build:unpacked  # dist-unpacked/: live foxslash, fixed dev ID for sign-in
bun run lint:firefox
```

Page selectors are served by foxslash and bundled as a fallback. See
[docs/remote-config.md](docs/remote-config.md) and
[src/config/CLAUDE.md](src/config/CLAUDE.md) for how to update them when
Humble changes its site.

## Building from source

Needs [Bun](https://bun.sh) 1.2 or later and the `zip` command.

```bash
bun install --frozen-lockfile
bun run build
```

`dist/` is the Chrome and Edge build and `dist-firefox/` the Firefox build
(also zipped as `extension-chrome.zip` and `extension-firefox.zip`).

## Releases

Pushing to `main` releases and publishes to the Chrome Web Store, Firefox
Add-ons and Edge Add-ons. See [docs/publishing.md](docs/publishing.md).
