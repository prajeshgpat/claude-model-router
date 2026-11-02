#!/usr/bin/env node
// Claude Code's UI shows the model it asked for, so this shows the one the proxy routed to.
import { readFileSync } from "node:fs";
import { readStatus } from "../src/infra/decision-log.mjs";

let sessionId = "";
try {
  sessionId = JSON.parse(readFileSync(0, "utf8")).session_id ?? "";
} catch (err) {
  process.stderr.write(`[router] could not read status input: ${err.message}\n`);
}

const status = sessionId ? readStatus(sessionId) : null;
process.stdout.write(status ? `router: ${status.tier} (${status.reason})\n` : "router: waiting\n");
