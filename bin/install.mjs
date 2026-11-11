#!/usr/bin/env node
// Makes `claude` start through the router, so Jev Router appears in /model. Pass --uninstall to undo.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startupFileFor, withAliases, withoutAliases } from "../src/infra/shell-alias.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = join(HERE, "router-claude.mjs");
const home = process.env.HOME ?? homedir();
const routerHome = process.env.ROUTER_HOME ?? join(home, ".claude-router");
const envFile = join(routerHome, ".env");

const readIfPresent = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");

function createEnvFile() {
  if (existsSync(envFile)) return;
  mkdirSync(routerHome, { recursive: true });
  copyFileSync(join(HERE, "..", ".env.example"), envFile);
}

const startupFile = startupFileFor(process.env.SHELL, home);
if (!startupFile) {
  process.stderr.write(
    `Could not detect zsh or bash from SHELL=${process.env.SHELL ?? ""}.\n` +
      `Add this to your shell startup file instead:\n  alias claude="node ${LAUNCHER}"\n`,
  );
  process.exit(1);
}

if (process.argv.includes("--uninstall")) {
  writeFileSync(startupFile, withoutAliases(readIfPresent(startupFile)));
  process.stdout.write(
    `Removed the aliases from ${startupFile}. Your key in ${envFile} was left in place.\n` +
      `Restart any running Claude Code session to stop routing it.\n`,
  );
} else {
  writeFileSync(startupFile, withAliases(readIfPresent(startupFile), LAUNCHER, fileURLToPath(import.meta.url)));
  createEnvFile();
  process.stdout.write(
    `Added the claude alias to ${startupFile}.\n\nNext steps:\n` +
      `  1. Add your TypeSafe key to ${envFile}\n` +
      `  2. Run: source ${startupFile}\n` +
      `  3. Run claude; sessions start on Jev Router\n\n` +
      `To turn routing off later, run: uninstall-claude-router\n`,
  );
}
