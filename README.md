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

These steps produce the exact files in the published zips (AMO reviewers: the
Firefox add-on is `dist-firefox/`).

### Requirements

- **OS:** Linux or macOS (released builds are made on Ubuntu 26.04). On
  Windows, use WSL.
- **Bun 1.4.5** (releases are built with it; 1.2.11 also gives identical
  output). Install that exact version:

  ```bash
  curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.5"
  ```

  Then open a new shell, or run `export PATH="$HOME/.bun/bin:$PATH"`, and check
  with `bun --version`.
- **Node.js 26** (Vite runs under Node; 22 also gives identical output). Install
  from <https://nodejs.org/> or with a version manager, for example
  `nvm install 26`.
- **zip** (Info-ZIP 3.0), for the zip files: `sudo apt install zip` on
  Debian/Ubuntu; included with macOS.

No network access is needed after `bun install`, and no other tools or global
packages are used. All dependency versions are locked in `bun.lock`.

### Build

```bash
./build-for-review.sh
```

The script checks the tools above, then runs the two build steps:

1. `bun install --frozen-lockfile` installs the exact dependency versions from
   `bun.lock`.
2. `bun run build` typechecks (`tsc`), bundles with Vite into `dist/`, runs
   `postbuildfixes.ts` (removes `use_dynamic_url` from the manifest and writes
   the Firefox copy `dist-firefox/`, whose only difference is
   `background.scripts` in place of `background.service_worker`), then zips
   both.

Output: `dist-firefox/` and `extension-firefox.zip` (Firefox), `dist/` and
`extension-chrome.zip` (Chrome and Edge). To compare with the published add-on,
unzip it and run `diff -r dist-firefox <unzipped folder>`.

## Releases

Pushing to `main` releases and publishes to the Chrome Web Store, Firefox
Add-ons and Edge Add-ons. See [docs/publishing.md](docs/publishing.md).
