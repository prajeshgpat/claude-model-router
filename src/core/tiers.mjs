// Model tiers and routing limits. Tiers are ordered cheapest first.

export const TIERS = [
  { name: "haiku", id: "claude-haiku-5-5" },
  { name: "sonnet", id: "claude-sonnet-5-5" },
  { name: "opus", id: "claude-opus-5-5" },
  { name: "fable", id: "claude-fable-5-1" },
];

/** Model id offered in /model. Any other model is the user's own choice and passes through. */
export const SENTINEL_MODEL = "jev-router";

export const DEFAULT_TIER = "sonnet";

export const LIMITS = {
  yesAbove: 0.7,
  noBelow: 0.3,
  /**
   * Switching models rebuilds the prompt cache, so downgrades stop paying off in long
   * conversations. Carried over from jev-router, whose measurements used older prices;
   * re-measure against real usage before relying on it.
   */
  downgradeMaxContextTokens: 20000,
  jevTimeoutMs: 3000,
  maxRequestChars: 60000,
  maxPreviousAssistantChars: 2000,
};

export const rankOf = (name) => TIERS.findIndex((tier) => tier.name === name);

export const idOf = (name) => TIERS.find((tier) => tier.name === name)?.id;

export const fableAllowed = (env = process.env) => env.ROUTER_ALLOW_FABLE === "1";
