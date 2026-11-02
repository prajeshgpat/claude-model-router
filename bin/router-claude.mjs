#!/usr/bin/env node
// Starts the routing proxy, then runs the real Claude Code against it.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startProxy } from "../src/api/proxy.mjs";
import { SENTINEL_MODEL } from "../src/core/tiers.mjs";
import { ROUTER_HOME, recordDecision, recordError } from "../src/infra/decision-log.mjs";
import { createJevClient } from "../src/infra/jev-client.mjs";
import { hasCustomStatusLine, readSavedModel, restoreSavedModel } from "../src/infra/settings.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANTHROPIC_URL = "https://api.anthropic.com";

function loadRouterEnv() {
  try {
    process.loadEnvFile(join(ROUTER_HOME, ".env"));
  } catch (err) {
    if (err.code !== "ENOENT") process.stderr.write(`[router] could not read .env: ${err.message}\n`);
  }
}

/** Adds a status line for this session only, leaving one the user configured alone. */
function statusLineArgs() {
  if (hasCustomStatusLine()) return [];
  const file = join(ROUTER_HOME, "settings.json");
  const command = `"${process.execPath}" "${join(HERE, "router-statusline.mjs")}"`;
  mkdirSync(ROUTER_HOME, { recursive: true });
  writeFileSync(file, JSON.stringify({ statusLine: { type: "command", command } }));
  return ["--settings", file];
}

const routingEnv = (port) => ({
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? SENTINEL_MODEL,
  ANTHROPIC_CUSTOM_MODEL_OPTION: SENTINEL_MODEL,
  ANTHROPIC_CUSTOM_MODEL_OPTION_NAME: "Jev Router",
  ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION: "Route each turn to the cheapest sufficient model",
  ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES: "thinking,adaptive_thinking,interleaved_thinking,effort,max_effort",
  CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: "1",
});

function runClaude(args, env, onExit) {
  // The child owns Ctrl-C; the proxy has to outlive it to serve its last requests.
  process.on("SIGINT", () => {});
  const child = spawn("claude", args, { stdio: "inherit", env });
  child.on("error", (err) => {
    process.stderr.write(`[router] could not start Claude Code: ${err.message}\n`);
    onExit();
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    onExit();
    process.exit(signal ? 1 : (code ?? 0));
  });
}

loadRouterEnv();
const args = process.argv.slice(2);
const apiKey = process.env.TYPESAFE_API_KEY;

if (!apiKey) {
  process.stderr.write(`[router] no TYPESAFE_API_KEY in ${join(ROUTER_HOME, ".env")}; running without routing\n`);
  runClaude(args, process.env, () => {});
} else {
  const savedModel = readSavedModel();
  const { TYPESAFE_API_KEY: _key, ...childEnv } = process.env;
  const { port, close } = await startProxy({
    upstreamURL: process.env.ANTHROPIC_BASE_URL ?? ANTHROPIC_URL,
    askJev: createJevClient({ apiKey, onError: recordError }),
    record: recordDecision,
  });
  const cleanup = () => {
    close();
    restoreSavedModel(savedModel);
  };
  runClaude([...args, ...statusLineArgs()], { ...childEnv, ...routingEnv(port) }, cleanup);
}
