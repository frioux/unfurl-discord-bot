# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the bot (Node runs the TypeScript directly via native type stripping; loads `.env` if present; no build step). Requires Node >=22.18.
- `npm test` — run all tests (`node:test`)
- `npm run test:watch` — run tests in watch mode
- `node --test --disable-warning=ExperimentalWarning tests/db.test.ts` — run a single test file
- `node --test --test-name-pattern="creates the replacements table" --disable-warning=ExperimentalWarning tests/db.test.ts` — run a single test by name
- `npm run typecheck` (`tsc --noEmit`) — type-check without emitting

Source is run as TypeScript directly, so relative imports must use `.ts` extensions, use `import type` for type-only imports, and avoid non-erasable syntax (enums, parameter properties, namespaces).

## Architecture

The bot auto-replaces domain names in Discord message URLs (e.g., `instagram.com` → `vxinstagram.com`) and lets users manage replacement rules via slash commands. SQLite stores the rules with an audit trail.

Four modules with a one-directional dependency graph:

- **`src/index.ts`** — entry point. Creates Discord client, wires events (`MessageCreate` → unfurl, `InteractionCreate` → commands), registers slash commands on ready. Imports from all other modules.
- **`src/commands.ts`** — slash command builders and `handleInteraction` handler. Four commands: `/unfurl-add`, `/unfurl-update`, `/unfurl-delete`, `/unfurl-list`. Takes `Database` as a parameter (dependency injection). Imports from `db.ts`.
- **`src/db.ts`** — SQLite layer. `createDb` initializes schema, exports CRUD functions (`addReplacement`, `getReplacement`, `getAllReplacements`, `updateReplacement`, `deleteReplacement`). Uses built-in `node:sqlite` (`DatabaseSync`); all functions take the `DatabaseSync` as first argument. Uses WAL mode.
- **`src/unfurl.ts`** — pure functions with zero dependencies. `extractUrls` (regex + `URL` validation) and `replaceUrl` (hostname swap preserving path/query/fragment).

## Testing

Tests use `node:test` + `node:assert/strict` and mirror source files 1:1 in `tests/`. Database tests use `:memory:` SQLite. Command tests use a `mockInteraction` helper that mocks Discord's `ChatInputCommandInteraction` with `mock.fn()` (from `node:test`) for the reply method, paired with real in-memory databases.

## Configuration

Environment variables via `.env` (see `.env.example`):
- `DISCORD_TOKEN` (required)
- `DATABASE_PATH` (defaults to `./unfurl.db`)

The bot requires the **Message Content** privileged intent enabled in the Discord Developer Portal, and the invite URL needs `bot` + `applications.commands` scopes with `View Channels`, `Send Messages`, `Read Message History`, and `Manage Messages` permissions. `Manage Messages` is needed to suppress embeds on the original message; channel permission overrides that deny it to `@everyone` also strip it from the bot unless the bot's role gets an explicit allow on that channel/category (symptom: `Failed to suppress embeds: DiscordAPIError[50013]: Missing Permissions` in the logs).

## Deployment

Production runs on the Raspberry Pi, reachable as `ssh pi@raspberrypi` (Tailscale; SSH as `frew` is refused by tailnet policy). The checkout is `/home/pi/unfurl-discordbot`, run by the systemd unit `unfurl-discordbot.service` (`ExecStart=/opt/node/bin/node --env-file-if-exists=.env --disable-warning=ExperimentalWarning src/index.ts`, `Restart=always`). There is no git on the Pi.

Node on the Pi is the official armv7l tarball unpacked in `/opt` with `/opt/node` symlinked to the current version (use `PATH=/opt/node/bin:$PATH` for `npm`). The Pi is 32-bit ARM, and Node 22 is the last release line with armv7l builds (EOL April 2027); `/usr/local/bin/node` is an old Node 20 and is not used by the bot.

- Logs: `ssh pi@raspberrypi 'journalctl -u unfurl-discordbot --no-pager -n 200'`
- Restart: `ssh pi@raspberrypi 'sudo systemctl restart unfurl-discordbot'`
- Deploy: copy changed files over, e.g. `scp src/index.ts pi@raspberrypi:unfurl-discordbot/src/`, then restart. If dependencies change, copy `package*.json` and run `PATH=/opt/node/bin:$PATH npm ci --omit=dev` on the Pi too.

The Pi is wired (eth0); Wi-Fi is disabled via `dtoverlay=disable-wifi` in `/boot/config.txt` because the unused wlan0 flapped constantly and coincided with Discord interactions timing out.
