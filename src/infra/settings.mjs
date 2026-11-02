// Claude Code saves a /model selection to settings, which would leave the sentinel behind for
// sessions without the proxy. These helpers put the earlier value back on exit.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SENTINEL_MODEL } from "../core/tiers.mjs";

const defaultPath = () => join(homedir(), ".claude", "settings.json");

const readSettings = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

export const readSavedModel = (path = defaultPath()) => readSettings(path)?.model;

export const hasCustomStatusLine = (path = defaultPath()) => Boolean(readSettings(path)?.statusLine);

/** Restores the model only if the sentinel was saved; a real model the user picked is kept. */
export function restoreSavedModel(savedModel, path = defaultPath()) {
  const settings = readSettings(path);
  if (settings?.model !== SENTINEL_MODEL) return;
  const { model: _sentinel, ...rest } = settings;
  const restored = savedModel === undefined ? rest : { ...rest, model: savedModel };
  writeFileSync(path, `${JSON.stringify(restored, null, 2)}\n`);
}
