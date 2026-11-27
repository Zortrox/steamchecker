# SteamChecker

Browser extension for Chrome and Firefox that grays out Steam games you
already own and highlights wishlisted ones on Humble Bundle.

## Development

```bash
bun install
bun run dev      # load dist/ as an unpacked extension
bun run test
bun run build    # extension-chrome.zip and extension-firefox.zip
bun run lint:firefox
```

Page selectors are served by foxslash and bundled as a fallback. See
[docs/remote-config.md](docs/remote-config.md) and
[src/config/CLAUDE.md](src/config/CLAUDE.md) for how to update them when
Humble changes its site.
