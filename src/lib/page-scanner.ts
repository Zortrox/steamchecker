import type { PageRule, SteamcheckerConfig, TargetRule } from "../config/schema";

export type FoundGame = {
  /** Normalized title, comparable with `normalizeTitle(steamName)`. */
  name: string;
  wrapper: HTMLElement;
  target: TargetRule;
};

/** Lowercase, strip everything except letters, digits and spaces, collapse spaces. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchPage(
  config: SteamcheckerConfig,
  pathname: string,
): PageRule | undefined {
  return config.pages.find((page) => new RegExp(page.path).test(pathname));
}

function readTitle(wrapper: HTMLElement, target: TargetRule): string | undefined {
  const titleElement = wrapper.matches(target.title)
    ? wrapper
    : wrapper.querySelector<HTMLElement>(target.title);
  if (!titleElement) return undefined;

  const raw = target.title_attribute
    ? titleElement.getAttribute(target.title_attribute)
    : titleElement.textContent;

  return raw?.trim() || undefined;
}

/** Find every game element on the page described by `page`. */
export function scanPage(root: ParentNode, page: PageRule): FoundGame[] {
  const found: FoundGame[] = [];

  for (const target of page.targets) {
    root.querySelectorAll<HTMLElement>(target.game_wrapper).forEach((wrapper) => {
      if (target.require && !wrapper.querySelector(target.require)) return;

      const title = readTitle(wrapper, target);
      if (!title) return;

      const name = normalizeTitle(title);
      if (name) found.push({ name, wrapper, target });
    });
  }

  return found;
}

export type HighlightKind = "owned" | "wished";

/** Apply the bundled style variant (and any config tweaks) to one game element. */
export function applyHighlight(
  game: FoundGame,
  kind: HighlightKind,
  badgeTemplate?: Element,
) {
  const { wrapper, target } = game;

  const highlightElement = target.highlight
    ? wrapper.querySelector<HTMLElement>(target.highlight)
    : wrapper;
  if (!highlightElement) return;

  highlightElement.classList.add(`steamchecker-${kind}${target.class_type}`);

  for (const [name, value] of Object.entries(target.style_vars ?? {})) {
    highlightElement.style.setProperty(name, value);
  }

  if (kind === "wished" && target.badge && badgeTemplate) {
    const badgeParent =
      target.badge === ":scope" ? wrapper : wrapper.querySelector(target.badge);
    if (badgeParent && !badgeParent.querySelector(":scope > .steamchecker-badge")) {
      badgeParent.append(badgeTemplate.cloneNode(true));
    }
  }

  for (const [selector, declarations] of Object.entries(target.extra_styles ?? {})) {
    const elements =
      selector === ":scope"
        ? [wrapper]
        : Array.from(wrapper.querySelectorAll<HTMLElement>(selector));
    elements.forEach((element) => Object.assign(element.style, declarations));
  }
}
