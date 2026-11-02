// The routing truth table. Pure: Jev supplies judgments and this file decides the tier.
import { DEFAULT_TIER, LIMITS, TIERS, rankOf } from "./tiers.mjs";

const OVERRIDE = new RegExp(
  `\\b(?:use|switch to)\\s+(${TIERS.map((tier) => tier.name).join("|")})\\b`,
  "i",
);

const STRONG_SIGNALS = ["unknown_cause", "design_decision", "auth_or_security", "concurrency", "data_migration"];

const isYes = (probability) => probability > LIMITS.yesAbove;
const isNo = (probability) => probability < LIMITS.noBelow;

/** The tier named in the prompt, such as "use opus", or null. */
export function detectOverride(prompt) {
  return OVERRIDE.exec(prompt ?? "")?.[1].toLowerCase() ?? null;
}

/** Maps judgments to the tier the task needs, ignoring the session's current model. */
function tierForTask(answers, allowFable) {
  if (isYes(answers.long_running)) {
    return { tier: allowFable ? "fable" : "opus", reason: "long-running" };
  }
  const strong = STRONG_SIGNALS.map((name) => answers[name]);
  if (strong.some(isYes)) return { tier: "opus", reason: "hard-signal" };
  if (!strong.every(isNo)) return { tier: "sonnet", reason: "hard-signal-unsettled", holdCurrent: true };
  const cheapWork = isYes(answers.mechanical_task) || isYes(answers.factual_question);
  if (cheapWork && isNo(answers.multi_module)) return { tier: "haiku", reason: "simple-task" };
  return { tier: "sonnet", reason: "routine" };
}

/**
 * Decides the tier for a new turn.
 *
 * @param {object} input
 * @param {string} input.prompt          the user's text, checked for an explicit override
 * @param {?object} input.answers        Noul probabilities by question name; null if Jev failed
 * @param {?string} input.current        tier pinned for this conversation; null on its first turn
 * @param {number} input.contextTokens   approximate conversation size
 * @param {boolean} input.allowFable     whether the router may pick Fable by itself
 * @returns {{tier: string, reason: string}}
 */
export function decide({ prompt, answers, current, contextTokens = 0, allowFable = false }) {
  const override = detectOverride(prompt);
  if (override) return { tier: override, reason: "override" };

  const fallback = current ?? DEFAULT_TIER;
  if (!answers) return { tier: fallback, reason: "jev-unavailable" };
  if (current && isYes(answers.approval_only)) return { tier: current, reason: "continuation" };

  const { tier, reason, holdCurrent } = tierForTask(answers, allowFable);
  if (!current || rankOf(tier) >= rankOf(current)) return { tier, reason };
  if (holdCurrent) return { tier: current, reason: `${reason}-no-downgrade` };
  if (contextTokens > LIMITS.downgradeMaxContextTokens) {
    return { tier: current, reason: "downgrade-not-worth-cache-rebuild" };
  }
  return { tier, reason };
}
