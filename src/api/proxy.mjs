// Loopback proxy between Claude Code and the Anthropic API. Auth headers pass through unread.
import { writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { decide } from "../core/policy.mjs";
import { DEFAULT_TIER, SENTINEL_MODEL, fableAllowed, idOf } from "../core/tiers.mjs";
import {
  conversationKey,
  estimateTokens,
  newTurnPrompt,
  previousAssistantText,
  sessionOf,
} from "../core/turn.mjs";
import { withSanitizedTools, withTier } from "./request-body.mjs";

const MAX_CONVERSATIONS = 50;
const isMessagesPath = (url) => /^\/v1\/messages(\/|\?|$)/.test(url ?? "");
const isNewMessagePath = (url) => /^\/v1\/messages(\?|$)/.test(url ?? "");

/** Picks the tier for a sentinel request, consulting Jev only on the first request of a turn. */
async function resolveTier({ body, url, pins, askJev, record }) {
  const key = conversationKey(body);
  const prompt = isNewMessagePath(url) ? newTurnPrompt(body) : null;
  const pin = pins.get(key);
  if (!prompt) return pin?.tier ?? DEFAULT_TIER;

  // Claude Code resends the same request on API errors; a retry is not a new turn.
  const turnLength = body.messages.length;
  if (pin?.turnLength === turnLength) return pin.tier;

  const current = pin?.tier ?? null;
  const answers = await askJev({ prompt, previousAssistant: previousAssistantText(body) });
  const contextTokens = estimateTokens(body);
  const { tier, reason } = decide({ prompt, answers, current, contextTokens, allowFable: fableAllowed() });

  if (!pin && pins.size >= MAX_CONVERSATIONS) pins.delete(pins.keys().next().value);
  pins.set(key, { tier, turnLength });
  record(sessionOf(body) || key, { tier, model: idOf(tier), reason, previous: current, contextTokens, answers });
  return tier;
}

/** Returns the bytes to send upstream. An unparseable body passes through for the API to reject. */
async function rewrite(raw, url, deps) {
  if (!isMessagesPath(url)) return raw;
  let body;
  try {
    body = JSON.parse(raw.toString());
  } catch {
    return raw;
  }
  if (process.env.ROUTER_DUMP) {
    writeFileSync(`${process.env.ROUTER_DUMP}.${Date.now()}.json`, JSON.stringify(body, null, 2));
  }
  const sanitized = withSanitizedTools(body);
  if (body.model !== SENTINEL_MODEL) return Buffer.from(JSON.stringify(sanitized));
  const tier = await resolveTier({ body, url, ...deps });
  return Buffer.from(JSON.stringify(withTier(sanitized, tier)));
}

function forward(req, res, payload, upstreamURL) {
  const target = new URL(upstreamURL);
  const { "content-length": _dropped, ...headers } = req.headers;
  const upstream = (target.protocol === "http:" ? http : https).request(
    {
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname.replace(/\/$/, "")}${req.url}`,
      method: req.method,
      headers: { ...headers, host: target.host, "content-length": payload.length },
    },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: err.message } }));
  });
  upstream.end(payload);
}

/** Starts the proxy on a random loopback port. */
export async function startProxy({ upstreamURL, askJev, record }) {
  const pins = new Map();
  const server = http.createServer((req, res) => {
    if (req.method === "HEAD") return res.writeHead(200).end();
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const payload = await rewrite(Buffer.concat(chunks), req.url, { pins, askJev, record });
      forward(req, res, payload, upstreamURL);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { port: server.address().port, close: () => server.close() };
}
