/**
 * Page config served by foxslash (and bundled as a fallback in
 * `default-config.json`). It is plain data: selectors, regexes, the name of a
 * bundled style variant, and a small allowlist of inline style values. No CSS
 * text or script is ever loaded from the server, which keeps the extension
 * inside the Chrome Web Store and AMO "no remote code" rules.
 *
 * See `docs/remote-config.md` for the server contract.
 */

export const CONFIG_SCHEMA_VERSION = 2;

/** Style variants that exist in `steamcheckerStyles.css`. */
export const STYLE_VARIANTS = ["Card", "LibraryRow", "Game", "Key"] as const;
export type StyleVariant = (typeof STYLE_VARIANTS)[number];

export type TargetRule = {
  /** Stable name used in logs and tests, e.g. `bundle-items`. */
  id: string;

  /** Selector for each game element on the page. */
  game_wrapper: string;

  /** Selector (inside the wrapper) for the element holding the title. */
  title: string;

  /** Read the title from this attribute instead of the element's text. */
  title_attribute?: string | null;

  /** Only use wrappers that contain a match, e.g. `[aria-label="Steam"]`. */
  require?: string | null;

  /** Element (inside the wrapper) that gets the class. Defaults to the wrapper. */
  highlight?: string | null;

  /**
   * Where the gold present-icon badge goes on wishlist
   * hits: a selector inside the wrapper, or `:scope` for the wrapper itself.
   */
  badge?: string | null;

  /** Bundled style variant; produces `steamchecker-owned<Variant>` etc. */
  class_type: StyleVariant;

  /**
   * CSS custom properties set on the highlighted element, used to tune the
   * bundled styles (e.g. `{"--sc-owned-opacity": "0.4"}`). Names must start
   * with `--sc-`.
   */
  style_vars?: Record<string, string> | null;

  /**
   * Inline styles, keyed by a selector relative to the wrapper (`:scope` for
   * the wrapper itself). Only properties in `ALLOWED_STYLE_PROPERTIES` apply.
   */
  extra_styles?: Record<string, Record<string, string>> | null;
};

export type PageRule = {
  id: string;
  /** Regex tested against `location.pathname`. */
  path: string;
  targets: TargetRule[];
};

export type SteamcheckerConfig = {
  schema_version: typeof CONFIG_SCHEMA_VERSION;
  /** Free-form revision label, logged so you can tell which config is live. */
  revision: string;
  pages: PageRule[];
};

/** Inline style properties the server may set (camelCase, as in `element.style`). */
export const ALLOWED_STYLE_PROPERTIES = new Set([
  "position",
  "display",
  "zIndex",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "overflow",
  "borderRadius",
  "opacity",
]);

const UNSAFE_VALUE = /url\s*\(|expression\s*\(|javascript:|@import|[<>{};\\]/i;

export class ConfigError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConfigError(`${where} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, where: string): string | null {
  if (value === undefined || value === null) return null;
  return assertString(value, where);
}

function assertSelector(value: unknown, where: string): string {
  const selector = assertString(value, where);
  try {
    document.createDocumentFragment().querySelector(selector);
  } catch {
    throw new ConfigError(`${where} is not a valid selector: ${selector}`);
  }
  return selector;
}

function optionalSelector(value: unknown, where: string): string | null {
  if (value === undefined || value === null) return null;
  return assertSelector(value, where);
}

function assertSafeValue(value: unknown, where: string): string {
  const text = assertString(value, where);
  if (UNSAFE_VALUE.test(text)) {
    throw new ConfigError(`${where} has a disallowed value: ${text}`);
  }
  return text;
}

function parseStyleVars(value: unknown, where: string) {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new ConfigError(`${where} must be an object`);

  const vars: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value)) {
    if (!/^--sc-[a-z0-9-]+$/.test(name)) {
      throw new ConfigError(`${where}.${name}: names must match --sc-*`);
    }
    vars[name] = assertSafeValue(raw, `${where}.${name}`);
  }
  return vars;
}

function parseExtraStyles(value: unknown, where: string) {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new ConfigError(`${where} must be an object`);

  const styles: Record<string, Record<string, string>> = {};
  for (const [selector, declarations] of Object.entries(value)) {
    if (selector !== ":scope") assertSelector(selector, `${where} key`);
    if (!isRecord(declarations)) {
      throw new ConfigError(`${where}["${selector}"] must be an object`);
    }

    styles[selector] = {};
    for (const [property, raw] of Object.entries(declarations)) {
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
        throw new ConfigError(`${where}: property "${property}" is not allowed`);
      }
      styles[selector][property] = assertSafeValue(
        raw,
        `${where}["${selector}"].${property}`,
      );
    }
  }
  return styles;
}

function parseTarget(value: unknown, where: string): TargetRule {
  if (!isRecord(value)) throw new ConfigError(`${where} must be an object`);

  const classType = assertString(value.class_type, `${where}.class_type`);
  if (!(STYLE_VARIANTS as readonly string[]).includes(classType)) {
    throw new ConfigError(
      `${where}.class_type "${classType}" is not one of ${STYLE_VARIANTS.join(", ")}`,
    );
  }

  return {
    id: assertString(value.id, `${where}.id`),
    game_wrapper: assertSelector(value.game_wrapper, `${where}.game_wrapper`),
    title: assertSelector(value.title, `${where}.title`),
    title_attribute: optionalString(value.title_attribute, `${where}.title_attribute`),
    require: optionalSelector(value.require, `${where}.require`),
    highlight: optionalSelector(value.highlight, `${where}.highlight`),
    badge:
      value.badge === ":scope" ? ":scope" : optionalSelector(value.badge, `${where}.badge`),
    class_type: classType as StyleVariant,
    style_vars: parseStyleVars(value.style_vars, `${where}.style_vars`),
    extra_styles: parseExtraStyles(value.extra_styles, `${where}.extra_styles`),
  };
}

function parsePage(value: unknown, where: string): PageRule {
  if (!isRecord(value)) throw new ConfigError(`${where} must be an object`);

  const path = assertString(value.path, `${where}.path`);
  try {
    new RegExp(path);
  } catch {
    throw new ConfigError(`${where}.path is not a valid regex: ${path}`);
  }

  if (!Array.isArray(value.targets) || value.targets.length === 0) {
    throw new ConfigError(`${where}.targets must be a non-empty array`);
  }

  return {
    id: assertString(value.id, `${where}.id`),
    path,
    targets: value.targets.map((t, i) => parseTarget(t, `${where}.targets[${i}]`)),
  };
}

/**
 * Validate untrusted JSON and return a clean config. Throws `ConfigError` on
 * anything unexpected, so a broken server response never reaches the page.
 */
export function parseConfig(value: unknown): SteamcheckerConfig {
  if (!isRecord(value)) throw new ConfigError("config must be an object");

  if (value.schema_version !== CONFIG_SCHEMA_VERSION) {
    throw new ConfigError(
      `unsupported schema_version ${String(value.schema_version)}, expected ${CONFIG_SCHEMA_VERSION}`,
    );
  }

  if (!Array.isArray(value.pages)) {
    throw new ConfigError("pages must be an array");
  }

  return {
    schema_version: CONFIG_SCHEMA_VERSION,
    revision: assertString(value.revision, "revision"),
    pages: value.pages.map((p, i) => parsePage(p, `pages[${i}]`)),
  };
}
