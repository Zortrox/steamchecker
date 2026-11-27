import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json" with { type: "json" };
const { version } = packageJson;

const [major, minor, patch, label = "0"] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.]+/g, "")
  .split(/[.]/);

/**
 * Public key for non-store builds only. It pins the unpacked extension ID to
 * ceggehhaldhcfgpgkfjlmppeagigocck, so the sign-in redirect URL
 * (https://ceggehhaldhcfgpgkfjlmppeagigocck.chromiumapp.org/) is the same on
 * every machine and can sit in foxslash's dev allowlist. The private key was
 * discarded; it isn't needed to load an unpacked extension.
 */
const DEV_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAunqYPzCcWsubAYm9uJ/f8rKaIC2cUd5fFZlGA22k/0GXoGoh8dIC+iNTS68a4c9OvWdv69U+eWlXHJ1D+YNtSGHT+Tf+rGTnxRYKMiSDhjf41NPzqQXpqn9mLEiukqw1zK8m047mncPMuyaJ4fKzFehMrJxhUGjfHJyavsZLWVP/UrVf5Ak3xbZXRikebvmojVQQhj2TxWHdtsrAIGWTkoDrBDpXndU8+m+zLGrFgFVnc5ZRJ9Ux93UFxgm/xTEe4SP31kCvUbi+9+fju13L3iTp8kXTfj83oblkbSJWGvhWXIMxSvV9dV/y4uknqSvIeHPNqkfTA3jZ8JPrXJxLUwIDAQAB";

const LOCAL_FOXSLASH = "http://localhost:8003/*";

export default defineManifest(async (env) => ({
  manifest_version: 3,

  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,

  name: env.mode === "production" ? "SteamChecker" : "[INTERNAL] SteamChecker",

  ...(env.mode === "production" ? {} : { key: DEV_PUBLIC_KEY }),

  description:
    "Grays-out & highlights owned/wishlisted Steam games on Humble Bundle",

  icons: {
    128: "icons/icon-128.png",
    48: "icons/icon-48.png",
    16: "icons/icon-16.png",
  },

  permissions: ["storage", "identity"],

  host_permissions: [
    "https://foxslash.com/api/steamchecker/*",
    ...(env.mode === "foxslash-local" ? [LOCAL_FOXSLASH] : []),
  ],

  // Chrome runs this as a service worker. postbuildfixes.ts writes a Firefox
  // copy of the build that uses `background.scripts` instead.
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },

  content_scripts: [
    {
      matches: ["https://www.humblebundle.com/*"],
      js: ["src/content.ts"],
    },
  ],

  action: {
    default_icon: {
      128: "icons/icon.png",
    },
    default_popup: "src/pages/popup/index.html",
  },

  web_accessible_resources: [
    {
      resources: ["icons/icon.png"],
      matches: ["https://www.humblebundle.com/*"],
    },
  ],

  browser_specific_settings: {
    gecko: {
      id: "@steamchecker",
      strict_min_version: "140.0",
      // The user's foxslash account (and its linked Steam account) is used to
      // look up owned and wishlisted games. Firefox requires this disclosure.
      data_collection_permissions: {
        required: ["personallyIdentifyingInfo"],
      },
    },
    gecko_android: {
      strict_min_version: "142.0",
    },
  },
}));
