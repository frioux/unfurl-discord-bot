# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — run the bot (uses `tsx`, no build step)
- `npm test` — run all tests
- `npm run test:watch` — run tests in watch mode
- `npx vitest run tests/db.test.ts` — run a single test file
- `npx vitest run tests/db.test.ts -t "creates the replacements table"` — run a single test by name
- `npx tsc --noEmit` — type-check without emitting

## Architecture

The bot auto-replaces domain names in Discord message URLs (e.g., `instagram.com` → `vxinstagram.com`) and lets users manage replacement rules via slash commands. SQLite stores the rules with an audit trail.

Four modules with a one-directional dependency graph:

- **`src/index.ts`** — entry point. Creates Discord client, wires events (`MessageCreate` → unfurl, `InteractionCreate` → commands), registers slash commands on ready. Imports from all other modules.
- **`src/commands.ts`** — slash command builders and `handleInteraction` handler. Four commands: `/unfurl-add`, `/unfurl-update`, `/unfurl-delete`, `/unfurl-list`. Takes `Database` as a parameter (dependency injection). Imports from `db.ts`.
- **`src/db.ts`** — SQLite layer. `createDb` initializes schema, exports CRUD functions (`addReplacement`, `getReplacement`, `getAllReplacements`, `updateReplacement`, `deleteReplacement`). All functions take `Database` as first argument. Uses WAL mode.
- **`src/unfurl.ts`** — pure functions with zero dependencies. `extractUrls` (regex + `URL` validation) and `replaceUrl` (hostname swap preserving path/query/fragment).

## Testing

Tests mirror source files 1:1 in `tests/`. Database tests use `:memory:` SQLite. Command tests use a `mockInteraction` helper that mocks Discord's `ChatInputCommandInteraction` with `vi.fn()` for the reply method, paired with real in-memory databases.

## Configuration

Environment variables via `.env` (see `.env.example`):
- `DISCORD_TOKEN` (required)
- `DATABASE_PATH` (defaults to `./unfurl.db`)

The bot requires the **Message Content** privileged intent enabled in the Discord Developer Portal, and the invite URL needs `bot` + `applications.commands` scopes with `View Channels`, `Send Messages`, `Read Message History`, and `Manage Messages` permissions. `Manage Messages` is needed to suppress embeds on the original message; channel permission overrides that deny it to `@everyone` also strip it from the bot unless the bot's role gets an explicit allow on that channel/category (symptom: `Failed to suppress embeds: DiscordAPIError[50013]: Missing Permissions` in the logs).

## Deployment

Production runs on the Raspberry Pi, reachable as `ssh pi@raspberrypi` (Tailscale; SSH as `frew` is refused by tailnet policy). The checkout is `/home/pi/unfurl-discordbot`, run by the systemd unit `unfurl-discordbot.service` (`npx tsx src/index.ts`, `Restart=always`). There is no git on the Pi.

- Logs: `ssh pi@raspberrypi 'journalctl -u unfurl-discordbot --no-pager -n 200'`
- Restart: `ssh pi@raspberrypi 'sudo systemctl restart unfurl-discordbot'`
- Deploy: copy changed files over, e.g. `scp src/index.ts pi@raspberrypi:unfurl-discordbot/src/`, then restart. If dependencies change, run `npm ci` on the Pi too.

The Pi is wired (eth0); Wi-Fi is disabled via `dtoverlay=disable-wifi` in `/boot/config.txt` because the unused wlan0 flapped constantly and coincided with Discord interactions timing out.
