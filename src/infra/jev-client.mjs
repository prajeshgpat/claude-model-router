// Calls TypeSafe's Jev over HTTP. Any failure returns null, which policy reads as "no judgment".
import { QUESTIONS, QUESTION_NAMES } from "../core/questions.mjs";
import { LIMITS } from "../core/tiers.mjs";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

export function buildRequest({ prompt, previousAssistant }) {
  const state = { request: prompt.slice(0, LIMITS.maxRequestChars) };
  // Left out when empty, because the model can read an empty field as a signal.
  if (previousAssistant) {
    state.previous_assistant_message = previousAssistant.slice(-LIMITS.maxPreviousAssistantChars);
  }
  return { model: MODEL, state, questions: QUESTIONS };
}

/** Flattens a response to probabilities by name, throwing unless every answer is valid. */
export function parseAnswers(response) {
  return Object.fromEntries(
    QUESTION_NAMES.map((name) => {
      const probability = response?.answers?.[name]?.noul;
      if (typeof probability !== "number" || probability < 0 || probability > 1) {
        throw new Error(`invalid Jev answer for ${name}`);
      }
      return [name, probability];
    }),
  );
}

export function createJevClient({ apiKey, fetchImpl = fetch, onError = () => {} }) {
  return async function askJev(input) {
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest(input)),
        signal: AbortSignal.timeout(LIMITS.jevTimeoutMs),
      });
      if (!response.ok) throw new Error(`Jev returned HTTP ${response.status}`);
      return parseAnswers(await response.json());
    } catch (err) {
      onError(err);
      return null;
    }
  };
}
