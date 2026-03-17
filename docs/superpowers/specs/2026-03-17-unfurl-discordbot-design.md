# Unfurl Discord Bot — Design Spec

## Overview

A Discord bot that automatically detects links matching configured domains and replies with rewritten URLs using replacement domains. Replacements are managed via slash commands and stored in SQLite.

## Behavior

### Link Unfurling

- The bot listens to all messages in channels it has access to
- Ignores messages from bots (including itself)
- Extracts URLs from message text using a simple regex, then parses each with Node's `URL` class
- For each URL, looks up the hostname against the `replacements` table (exact match on `source_domain`)
- If matched, constructs a new URL by replacing the hostname with `target_domain`, preserving the full path, query string, and fragment
- Sends one reply per matched URL, containing just the bare rewritten URL (so Discord auto-embeds it)

### Slash Commands

**`/unfurl-add source_domain target_domain`**
- Adds a new replacement rule
- Fails if `source_domain` already exists (directs user to `/unfurl-update`)
- Responds: "Added: `source_domain` → `target_domain`"

**`/unfurl-update source_domain target_domain`**
- Updates an existing replacement rule's target domain
- Fails if `source_domain` doesn't exist (directs user to `/unfurl-add`)
- Responds: "Updated: `source_domain` → `new_target` (was `old_target`)"

**`/unfurl-delete source_domain`**
- Deletes an existing replacement rule
- Fails if `source_domain` doesn't exist
- Responds: "Deleted: `source_domain` → `target_domain`"

**`/unfurl-list`**
- Lists all current replacements
- Read-only, no parameters

All mutating commands record who performed the action, when, and a link to the command message.

### Permissions

No custom permission system. Anyone in the server can use the management commands. Social accountability (tracked who/when/message-link) is the abuse deterrent. Discord's built-in slash command permissions can be configured by server admins later if needed.

## Data Model

Single SQLite table `replacements`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `source_domain` | TEXT UNIQUE NOT NULL | Domain to match (e.g., `www.instagram.com`) |
| `target_domain` | TEXT NOT NULL | Replacement domain (e.g., `vxinstagram.com`) |
| `added_by_id` | TEXT NOT NULL | Discord user ID of creator |
| `added_by_name` | TEXT NOT NULL | Discord username at time of creation |
| `added_at` | TEXT NOT NULL | ISO 8601 timestamp |
| `updated_by_id` | TEXT | Discord user ID of last updater |
| `updated_by_name` | TEXT | Discord username of last updater |
| `updated_at` | TEXT | ISO 8601 timestamp of last update |
| `message_link` | TEXT | Link to the Discord message that created/last modified the rule |

`source_domain` has a UNIQUE constraint for fast lookups and duplicate prevention.

## Architecture

Single-process Node.js bot with a few focused modules:

```
unfurl-discordbot/
├── src/
│   ├── index.ts        # Entry point — client setup, login, event wiring
│   ├── db.ts           # SQLite setup, schema migration, query functions
│   ├── unfurl.ts       # URL extraction and domain replacement logic
│   └── commands.ts     # Slash command definitions and handlers
├── package.json
├── tsconfig.json
└── .env                # DISCORD_TOKEN, DATABASE_PATH
```

### Dependencies

- **Runtime:** `discord.js`, `better-sqlite3`, `dotenv`
- **Dev:** `@types/better-sqlite3`, `typescript`, `tsx`

### Configuration

- `DISCORD_TOKEN` — bot token (via `.env`)
- `DATABASE_PATH` — path to SQLite file (via `.env`, defaults to `./unfurl.db`)

### Startup

1. Load environment variables
2. Initialize SQLite database (create table if not exists)
3. Register slash commands with Discord API
4. Start listening for messages and interactions

## Error Handling

- Invalid URLs in messages are silently skipped (not every URL-like string will parse)
- Database errors on slash commands return an ephemeral error message to the user
- Bot logs errors to stdout for operational visibility

## Testing Strategy

- Unit tests for `unfurl.ts` — URL extraction and domain replacement logic (pure functions, easy to test)
- Unit tests for `db.ts` — using an in-memory SQLite database
- Integration tests for command handlers with mocked Discord interactions
