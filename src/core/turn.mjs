// Reads what the router needs out of a Claude Code /v1/messages request body.
import { createHash } from "node:crypto";

const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

const textOf = (content) => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
};

/**
 * The text of a genuinely new user turn, or null. Tool-loop continuations end in a
 * `tool_result`, and tool-less requests are Claude Code's auxiliary calls; neither is routed.
 * Claude Code appends mid-conversation `system` messages after the user's, so they are skipped.
 */
export function newTurnPrompt(body) {
  if (!Array.isArray(body?.tools) || body.tools.length === 0) return null;
  const last = body.messages?.findLast((message) => message.role !== "system");
  if (last?.role !== "user") return null;
  if (Array.isArray(last.content) && last.content.some((block) => block.type === "tool_result")) {
    return null;
  }
  return textOf(last.content).replace(REMINDER, "").trim() || null;
}

/** The last assistant text before this turn, so that "yes, do it" can be judged. */
export function previousAssistantText(body) {
  const messages = body?.messages ?? [];
  const previous = messages.findLast((message) => message.role === "assistant");
  return previous ? textOf(previous.content).trim() : "";
}

/** Session id from request metadata, whose `user_id` is a JSON string. */
export function sessionOf(body) {
  try {
    return JSON.parse(body?.metadata?.user_id ?? "{}").session_id ?? "";
  } catch {
    return "";
  }
}

/** Separates the main agent from sub-agents, which share a session but not a first message. */
export function conversationKey(body) {
  const seed = `${sessionOf(body)}|${textOf(body?.messages?.[0]?.content)}`;
  return createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

export const estimateTokens = (body) => Math.round(JSON.stringify(body?.messages ?? []).length / 4);
