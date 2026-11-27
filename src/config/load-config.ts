import { FOXSLASH_API_URL } from "../lib/foxslash-api";
import bundledConfig from "./default-config.json";
import { parseConfig, type SteamcheckerConfig } from "./schema";

/**
 * Where foxslash serves the page config. Follows `VITE_FOXSLASH_API_URL`;
 * `VITE_STEAMCHECKER_CONFIG_URL` overrides just this URL.
 */
export const CONFIG_URL: string =
  import.meta.env.VITE_STEAMCHECKER_CONFIG_URL ?? `${FOXSLASH_API_URL}/config/v2`;

const CACHE_KEY = "remote_config_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

type ConfigCache = {
  fetched_at: number;
  config: unknown;
};

export type ConfigSource = "remote" | "cache" | "stale-cache" | "bundled";

export type LoadedConfig = {
  config: SteamcheckerConfig;
  source: ConfigSource;
};

async function readCache(): Promise<ConfigCache | undefined> {
  try {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    return stored[CACHE_KEY] as ConfigCache | undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(config: unknown) {
  const cache: ConfigCache = { fetched_at: Date.now(), config };
  try {
    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  } catch {
    // caching is best effort
  }
}

export async function clearConfigCache() {
  await chrome.storage.local.remove(CACHE_KEY);
}

function tryParse(value: unknown): SteamcheckerConfig | undefined {
  try {
    return parseConfig(value);
  } catch (err) {
    console.warn("SteamChecker: ignoring invalid config", err);
    return undefined;
  }
}

async function fetchRemote(): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(CONFIG_URL, {
      signal: controller.signal,
      cache: "no-cache",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the page config in this order:
 * 1. a cached server copy younger than the TTL,
 * 2. a fresh copy from foxslash,
 * 3. an older cached copy (server down),
 * 4. the config bundled with this build.
 */
export async function loadConfig(): Promise<LoadedConfig> {
  const cache = await readCache();
  const cached = cache ? tryParse(cache.config) : undefined;

  if (cached && cache && Date.now() - cache.fetched_at < CACHE_TTL_MS) {
    return { config: cached, source: "cache" };
  }

  try {
    const raw = await fetchRemote();
    const remote = tryParse(raw);
    if (remote) {
      await writeCache(raw);
      return { config: remote, source: "remote" };
    }
  } catch (err) {
    console.warn("SteamChecker: could not fetch config", err);
  }

  if (cached) return { config: cached, source: "stale-cache" };

  return { config: parseConfig(bundledConfig), source: "bundled" };
}
