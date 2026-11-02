// Records routing decisions locally. Prompt text is never written.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ROUTER_HOME = process.env.ROUTER_HOME ?? join(homedir(), ".claude-router");

const statusFile = (session) => join(ROUTER_HOME, `status-${session.replace(/[^\w-]/g, "_")}.json`);

const reportFailure = (err) => process.stderr.write(`[router] could not write log: ${err.message}\n`);

export function recordDecision(session, decision) {
  try {
    mkdirSync(ROUTER_HOME, { recursive: true });
    const entry = JSON.stringify({ at: new Date().toISOString(), session, ...decision });
    appendFileSync(join(ROUTER_HOME, "decisions.jsonl"), `${entry}\n`);
    if (session) writeFileSync(statusFile(session), entry);
  } catch (err) {
    reportFailure(err);
  }
}

export function recordError(err) {
  recordDecision("", { error: err.message });
}

/** The latest decision for a session, or null if none is recorded. */
export function readStatus(session) {
  try {
    return JSON.parse(readFileSync(statusFile(session), "utf8"));
  } catch {
    return null;
  }
}
