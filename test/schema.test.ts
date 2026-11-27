import { describe, expect, it } from "vitest";

import bundledConfig from "../src/config/default-config.json";
import { ConfigError, parseConfig } from "../src/config/schema";

const base = () => structuredClone(bundledConfig) as any;

describe("parseConfig", () => {
  it("accepts the bundled config", () => {
    expect(parseConfig(bundledConfig).pages.length).toBeGreaterThan(0);
  });

  it("rejects other schema versions", () => {
    expect(() => parseConfig({ ...base(), schema_version: 1 })).toThrow(ConfigError);
  });

  it("rejects unknown style variants", () => {
    const config = base();
    config.pages[0].targets[0].class_type = "Fancy";
    expect(() => parseConfig(config)).toThrow(/class_type/);
  });

  it("rejects invalid selectors and regexes", () => {
    const badSelector = base();
    badSelector.pages[0].targets[0].game_wrapper = "a[href=";
    expect(() => parseConfig(badSelector)).toThrow(/selector/);

    const badRegex = base();
    badRegex.pages[0].path = "(";
    expect(() => parseConfig(badRegex)).toThrow(/regex/);
  });

  it("only allows --sc-* variables with safe values", () => {
    const badName = base();
    badName.pages[0].targets[0].style_vars = { color: "red" };
    expect(() => parseConfig(badName)).toThrow(/--sc-/);

    const badValue = base();
    badValue.pages[0].targets[0].style_vars = { "--sc-owned-label": "url(https://x)" };
    expect(() => parseConfig(badValue)).toThrow(/disallowed/);

    const ok = base();
    ok.pages[0].targets[0].style_vars = { "--sc-owned-opacity": "0.3" };
    expect(parseConfig(ok).pages[0]!.targets[0]!.style_vars).toEqual({
      "--sc-owned-opacity": "0.3",
    });
  });

  it("only allows listed inline style properties", () => {
    const config = base();
    config.pages[0].targets[0].extra_styles = { ":scope": { backgroundImage: "none" } };
    expect(() => parseConfig(config)).toThrow(/not allowed/);
  });
});
