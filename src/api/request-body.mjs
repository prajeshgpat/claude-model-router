// Adjusts request bodies before they go upstream. Returns copies; thinking history is never touched,
// because the API itself drops any thinking block the routed model cannot read.
import { idOf } from "../core/tiers.mjs";

/**
 * Claude Code converts draft-04 MCP tool schemas only when talking to Anthropic directly, so
 * behind ANTHROPIC_BASE_URL the boolean form of exclusiveMinimum/Maximum has to be fixed here.
 */
export function sanitizeSchema(node) {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (!node || typeof node !== "object") return node;
  const out = Object.fromEntries(Object.entries(node).map(([key, value]) => [key, sanitizeSchema(value)]));
  for (const [exclusive, bound] of [
    ["exclusiveMinimum", "minimum"],
    ["exclusiveMaximum", "maximum"],
  ]) {
    if (typeof out[exclusive] !== "boolean") continue;
    if (out[exclusive] && typeof out[bound] === "number") {
      out[exclusive] = out[bound];
      delete out[bound];
    } else {
      delete out[exclusive];
    }
  }
  return out;
}

export function withSanitizedTools(body) {
  if (!Array.isArray(body.tools)) return body;
  const tools = body.tools.map((tool) =>
    tool.input_schema ? { ...tool, input_schema: sanitizeSchema(tool.input_schema) } : tool,
  );
  return { ...body, tools };
}

export const withTier = (body, tier) => ({ ...body, model: idOf(tier) });
