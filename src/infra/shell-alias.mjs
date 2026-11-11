// Manages the marked block of aliases in the user's shell startup file. String functions are pure.
import { existsSync } from "node:fs";
import { basename, join } from "node:path";

const BEGIN = "# >>> claude-model-router >>>";
const END = "# <<< claude-model-router <<<";
const BLOCK = new RegExp(`\\n?${BEGIN}[\\s\\S]*?${END}\\n?`, "g");
// Aliases written by hand or by older installers, outside the marked block.
const LEGACY_ALIAS = /^alias (claude|router-claude)=.*router-claude\.mjs.*\n?/gm;

export const ALIAS_NAMES = ["claude", "router-claude", "uninstall-claude-router"];

const shellQuote = (value) => `'${value.replaceAll("'", `'\\''`)}'`;

/** Removes the block and legacy aliases, so running the installer again never duplicates them. */
export const withoutAliases = (contents) =>
  contents.replace(BLOCK, "\n").replace(LEGACY_ALIAS, "").replace(/^\n+$/, "");

/** The uninstall alias also unaliases in the current shell, so no new terminal is needed. */
function uninstallCommand(installerPath) {
  return `node ${shellQuote(installerPath)} --uninstall && unalias ${ALIAS_NAMES.join(" ")}`;
}

export function withAliases(contents, launcherPath, installerPath) {
  const launch = shellQuote(`node ${shellQuote(launcherPath)}`);
  const block = [
    BEGIN,
    `alias claude=${launch}`,
    `alias router-claude=${launch}`,
    `alias uninstall-claude-router=${shellQuote(uninstallCommand(installerPath))}`,
    END,
  ].join("\n");
  const base = withoutAliases(contents).trimEnd();
  return `${base ? `${base}\n\n` : ""}${block}\n`;
}

/** The startup file for a shell, or null for shells whose alias syntax differs. */
export function startupFileFor(shell, home, platform = process.platform) {
  const name = basename(shell ?? "");
  if (name === "zsh") return join(home, ".zshrc");
  if (name !== "bash") return null;
  const profile = join(home, ".bash_profile");
  return platform === "darwin" || existsSync(profile) ? profile : join(home, ".bashrc");
}
