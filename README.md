# claude-model-router

Runs Claude Code through a local proxy that picks the cheapest sufficient model for each new user
turn. TypeSafe's Jev answers typed questions about the request, and a truth table in code turns the
answers into a model. Your Claude Code login, tools, and sessions work as usual.

```
router-claude -> loopback proxy -> api.anthropic.com
                      |
                      +-> Jev (once per new turn)
```

## Setup

Requires macOS or Linux with zsh or bash, Node 20.12+, Claude Code, and a
[TypeSafe API key](https://docs.typesafe.ai). There are no npm dependencies.

```sh
git clone <this-repo-url> claude-model-router
cd claude-model-router
node bin/install.mjs
```

The installer adds a `claude` alias to your shell startup file and creates
`~/.claude-router/.env`. Add your key to that file, open a new terminal, and run:

```sh
claude
```

Every session now starts on **Jev Router**, which is also listed in `/model`. Without a key, Claude
Code runs normally with no routing and prints a warning at startup.

Keep the cloned folder in place, because the alias points to it. If you move it, run the installer
again from the new location.

To bypass the router for one session, run `command claude`.

## Turning it off

```sh
uninstall-claude-router
```

This removes the aliases from your shell startup file and from the current shell, so `claude` runs
plain Claude Code right away. Restart any Claude Code session that is already running, since it
keeps using the proxy until it exits. Your key in `~/.claude-router/.env` is left in place, and
`node bin/install.mjs` turns routing back on. `node bin/install.mjs --uninstall` does the same
cleanup, and it also removes `claude` aliases that older installs added outside the marked block.

## How a tier is chosen

The first matching row wins. A Noul counts as yes above 0.7 and no below 0.3.

| Judgment | Tier |
|---|---|
| The prompt says "use/switch to haiku, sonnet, opus, or fable" | The named tier |
| Jev failed or timed out | Current tier, or Sonnet on a first turn |
| The prompt only approves or continues earlier work | Current tier |
| Whole-repo or multi-hour work | Fable if `ROUTER_ALLOW_FABLE=1`, otherwise Opus |
| Unknown-cause bug, design decision, auth/security, concurrency, or data migration | Opus |
| Any of those signals is unsettled (0.3 to 0.7) | Sonnet, and never a downgrade |
| Mechanical task or simple factual question, not spanning modules | Haiku |
| Anything else | Sonnet |

A downgrade is also refused once a conversation passes about 20k tokens, because switching models
rebuilds the prompt cache. Tool-loop requests and retries keep the tier chosen for the turn. Picking
a specific model in `/model` bypasses routing until you pick **Jev Router** again. That row only
appears in sessions started through the alias or `router-claude`, because `command claude` has no
proxy to route through.

The question wording is in `src/core/questions.mjs`, the truth table in `src/core/policy.mjs`, and
the model IDs and limits in `src/core/tiers.mjs`.

## Checking what it did

The status line shows the routed tier, because Claude Code's own UI and `modelUsage` only show
`jev-router`. If you have your own status line, it is left in place.

```sh
tail -f ~/.claude-router/decisions.jsonl
```

The log holds tiers, reasons, and Jev's probabilities, but no prompt text.

## Privacy

Each new prompt (up to 60k characters) and up to the last 2k characters of the previous assistant
message are sent to TypeSafe. Nothing else from the conversation is sent to it, and your Anthropic
credentials are never sent to it.

## Troubleshooting

Claude Code's request shape is undocumented and changes between versions. If routing stops after an
upgrade (the log stays empty), write the real request bodies to files and inspect them. These
contain your full conversation, so don't share them:

```sh
ROUTER_DUMP=/tmp/body router-claude   # writes each body to /tmp/body.<time>.json
```

## License

MIT. The proxy transport is adapted from
[jev-router](https://github.com/gargpratyush/jev-router), also MIT licensed.
