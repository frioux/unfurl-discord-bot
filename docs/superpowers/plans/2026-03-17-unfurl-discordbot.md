# Unfurl Discord Bot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Discord bot that auto-replaces domain names in posted links and lets users manage replacement rules via slash commands.

**Architecture:** Single-process Node.js bot with four focused modules: database layer (`db.ts`), URL extraction/replacement logic (`unfurl.ts`), slash command handlers (`commands.ts`), and entry point (`index.ts`). SQLite for persistence, discord.js for Discord integration.

**Tech Stack:** TypeScript, Node.js, discord.js, better-sqlite3, dotenv, vitest (testing), tsx (runtime)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/db.ts` | SQLite connection, schema creation, all database query functions (CRUD for replacements) |
| `src/unfurl.ts` | Extract URLs from text, look up domains, produce replacement URLs. Pure logic, no Discord dependency. |
| `src/commands.ts` | Slash command definitions (builders) and interaction handlers. Calls `db.ts` for data, formats Discord responses. |
| `src/index.ts` | Discord client setup, event wiring (messageCreate → unfurl, interactionCreate → commands), login. |
| `tests/db.test.ts` | Tests for db.ts using in-memory SQLite |
| `tests/unfurl.test.ts` | Tests for URL extraction and replacement logic |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `.env.example` | Example env file (no secrets) |
| `.gitignore` | Ignore node_modules, .env, *.db |

---

## Chunk 1: Project Setup and Database Layer

### Task 1: Initialize the project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize npm project and install dependencies**

```bash
cd /Users/frew/code/unfurl-discordbot
npm init -y
npm install discord.js better-sqlite3 dotenv
npm install -D typescript @types/better-sqlite3 @types/node tsx vitest
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.db
```

- [ ] **Step 4: Create .env.example**

```
DISCORD_TOKEN=your-bot-token-here
DATABASE_PATH=./unfurl.db
```

- [ ] **Step 5: Add scripts to package.json**

Add to `package.json`:
```json
{
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example
git commit -m "feat: initialize project with TypeScript, discord.js, better-sqlite3"
```

---

### Task 2: Database layer — tests

**Files:**
- Create: `tests/db.test.ts`

- [ ] **Step 1: Write tests for database initialization and CRUD**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createDb, addReplacement, getReplacement, getAllReplacements, updateReplacement, deleteReplacement } from "../src/db.js";
import Database from "better-sqlite3";

describe("db", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  describe("createDb", () => {
    it("creates the replacements table", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='replacements'")
        .all();
      expect(tables).toHaveLength(1);
    });
  });

  describe("addReplacement", () => {
    it("inserts a new replacement", () => {
      const result = addReplacement(db, {
        sourceDomain: "www.instagram.com",
        targetDomain: "vxinstagram.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: "https://discord.com/channels/1/2/3",
      });
      expect(result.source_domain).toBe("www.instagram.com");
      expect(result.target_domain).toBe("vxinstagram.com");
      expect(result.added_by_id).toBe("123");
      expect(result.added_by_name).toBe("testuser");
      expect(result.added_at).toBeTruthy();
      expect(result.message_link).toBe("https://discord.com/channels/1/2/3");
    });

    it("throws on duplicate source_domain", () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      expect(() =>
        addReplacement(db, {
          sourceDomain: "x.com",
          targetDomain: "other.com",
          addedById: "456",
          addedByName: "otheruser",
          messageLink: null,
        })
      ).toThrow();
    });
  });

  describe("getReplacement", () => {
    it("returns a replacement by source_domain", () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = getReplacement(db, "x.com");
      expect(result).not.toBeUndefined();
      expect(result!.target_domain).toBe("girlcockx.com");
    });

    it("returns undefined for non-existent domain", () => {
      const result = getReplacement(db, "nonexistent.com");
      expect(result).toBeUndefined();
    });
  });

  describe("getAllReplacements", () => {
    it("returns all replacements", () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      addReplacement(db, {
        sourceDomain: "www.instagram.com",
        targetDomain: "vxinstagram.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const results = getAllReplacements(db);
      expect(results).toHaveLength(2);
    });

    it("returns empty array when no replacements exist", () => {
      const results = getAllReplacements(db);
      expect(results).toHaveLength(0);
    });
  });

  describe("updateReplacement", () => {
    it("updates the target_domain and tracking fields", () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = updateReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "newdomain.com",
        updatedById: "456",
        updatedByName: "updater",
        messageLink: "https://discord.com/channels/1/2/4",
      });
      expect(result).not.toBeUndefined();
      expect(result!.target_domain).toBe("newdomain.com");
      expect(result!.updated_by_id).toBe("456");
      expect(result!.updated_by_name).toBe("updater");
      expect(result!.updated_at).toBeTruthy();
    });

    it("returns undefined for non-existent domain", () => {
      const result = updateReplacement(db, {
        sourceDomain: "nonexistent.com",
        targetDomain: "new.com",
        updatedById: "123",
        updatedByName: "user",
        messageLink: null,
      });
      expect(result).toBeUndefined();
    });
  });

  describe("deleteReplacement", () => {
    it("deletes a replacement and returns it", () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = deleteReplacement(db, "x.com");
      expect(result).not.toBeUndefined();
      expect(result!.source_domain).toBe("x.com");
      expect(getReplacement(db, "x.com")).toBeUndefined();
    });

    it("returns undefined for non-existent domain", () => {
      const result = deleteReplacement(db, "nonexistent.com");
      expect(result).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/db.test.ts
```

Expected: FAIL — `src/db.ts` doesn't exist yet.

- [ ] **Step 3: Commit**

```bash
git add tests/db.test.ts
git commit -m "test: add database layer tests"
```

---

### Task 3: Database layer — implementation

**Files:**
- Create: `src/db.ts`

- [ ] **Step 1: Implement db.ts**

```typescript
import Database from "better-sqlite3";

export interface Replacement {
  id: number;
  source_domain: string;
  target_domain: string;
  added_by_id: string;
  added_by_name: string;
  added_at: string;
  updated_by_id: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
  message_link: string | null;
}

export function createDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_domain TEXT UNIQUE NOT NULL,
      target_domain TEXT NOT NULL,
      added_by_id TEXT NOT NULL,
      added_by_name TEXT NOT NULL,
      added_at TEXT NOT NULL,
      updated_by_id TEXT,
      updated_by_name TEXT,
      updated_at TEXT,
      message_link TEXT
    )
  `);
  return db;
}

export function addReplacement(
  db: Database.Database,
  params: {
    sourceDomain: string;
    targetDomain: string;
    addedById: string;
    addedByName: string;
    messageLink: string | null;
  }
): Replacement {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO replacements (source_domain, target_domain, added_by_id, added_by_name, added_at, message_link)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    params.sourceDomain,
    params.targetDomain,
    params.addedById,
    params.addedByName,
    now,
    params.messageLink
  );
  return db.prepare("SELECT * FROM replacements WHERE id = ?").get(info.lastInsertRowid) as Replacement;
}

export function getReplacement(db: Database.Database, sourceDomain: string): Replacement | undefined {
  return db.prepare("SELECT * FROM replacements WHERE source_domain = ?").get(sourceDomain) as
    | Replacement
    | undefined;
}

export function getAllReplacements(db: Database.Database): Replacement[] {
  return db.prepare("SELECT * FROM replacements ORDER BY source_domain").all() as Replacement[];
}

export function updateReplacement(
  db: Database.Database,
  params: {
    sourceDomain: string;
    targetDomain: string;
    updatedById: string;
    updatedByName: string;
    messageLink: string | null;
  }
): Replacement | undefined {
  const existing = getReplacement(db, params.sourceDomain);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE replacements
    SET target_domain = ?, updated_by_id = ?, updated_by_name = ?, updated_at = ?, message_link = ?
    WHERE source_domain = ?
  `).run(
    params.targetDomain,
    params.updatedById,
    params.updatedByName,
    now,
    params.messageLink,
    params.sourceDomain
  );
  return getReplacement(db, params.sourceDomain);
}

export function deleteReplacement(db: Database.Database, sourceDomain: string): Replacement | undefined {
  const existing = getReplacement(db, sourceDomain);
  if (!existing) return undefined;
  db.prepare("DELETE FROM replacements WHERE source_domain = ?").run(sourceDomain);
  return existing;
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run tests/db.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat: implement database layer for replacements"
```

---

## Chunk 2: Unfurl Logic

### Task 4: Unfurl logic — tests

**Files:**
- Create: `tests/unfurl.test.ts`

- [ ] **Step 1: Write tests for URL extraction and replacement**

```typescript
import { describe, it, expect } from "vitest";
import { extractUrls, replaceUrl } from "../src/unfurl.js";

describe("extractUrls", () => {
  it("extracts a single URL from text", () => {
    const urls = extractUrls("check this out https://www.instagram.com/p/ABC123/");
    expect(urls).toEqual(["https://www.instagram.com/p/ABC123/"]);
  });

  it("extracts multiple URLs from text", () => {
    const urls = extractUrls("https://x.com/foo and https://www.instagram.com/p/123");
    expect(urls).toHaveLength(2);
  });

  it("returns empty array for text with no URLs", () => {
    const urls = extractUrls("no links here");
    expect(urls).toEqual([]);
  });

  it("handles URLs with query strings and fragments", () => {
    const urls = extractUrls("https://x.com/post?ref=home#top");
    expect(urls).toEqual(["https://x.com/post?ref=home#top"]);
  });

  it("extracts URLs from inside angle brackets", () => {
    const urls = extractUrls("check <https://x.com/foo> out");
    expect(urls).toEqual(["https://x.com/foo"]);
  });

  it("only matches http and https URLs", () => {
    const urls = extractUrls("not://a-real-url and https://valid.com/path");
    expect(urls).toEqual(["https://valid.com/path"]);
  });
});

describe("replaceUrl", () => {
  it("replaces the domain and preserves the path", () => {
    const result = replaceUrl("https://www.instagram.com/p/ABC123/", "www.instagram.com", "vxinstagram.com");
    expect(result).toBe("https://vxinstagram.com/p/ABC123/");
  });

  it("preserves query string and fragment", () => {
    const result = replaceUrl("https://x.com/post?ref=home#top", "x.com", "girlcockx.com");
    expect(result).toBe("https://girlcockx.com/post?ref=home#top");
  });

  it("preserves the protocol", () => {
    const result = replaceUrl("http://x.com/foo", "x.com", "girlcockx.com");
    expect(result).toBe("http://girlcockx.com/foo");
  });

  it("returns null if domain does not match", () => {
    const result = replaceUrl("https://other.com/path", "x.com", "girlcockx.com");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unfurl.test.ts
```

Expected: FAIL — `src/unfurl.ts` doesn't exist yet.

- [ ] **Step 3: Commit**

```bash
git add tests/unfurl.test.ts
git commit -m "test: add unfurl logic tests"
```

---

### Task 5: Unfurl logic — implementation

**Files:**
- Create: `src/unfurl.ts`

- [ ] **Step 1: Implement unfurl.ts**

```typescript
const URL_REGEX = /https?:\/\/[^\s<>\"')\]]+/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  return matches.filter((match) => {
    try {
      new URL(match);
      return true;
    } catch {
      return false;
    }
  });
}

export function replaceUrl(
  urlString: string,
  sourceDomain: string,
  targetDomain: string
): string | null {
  const url = new URL(urlString);
  if (url.hostname !== sourceDomain) return null;
  url.hostname = targetDomain;
  return url.toString();
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run tests/unfurl.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/unfurl.ts
git commit -m "feat: implement URL extraction and domain replacement"
```

---

## Chunk 3: Slash Commands and Bot Entry Point

### Task 6: Slash command definitions and handlers

**Files:**
- Create: `src/commands.ts`

- [ ] **Step 1: Implement commands.ts**

```typescript
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  REST,
  Routes,
} from "discord.js";
import type Database from "better-sqlite3";
import {
  addReplacement,
  getReplacement,
  getAllReplacements,
  updateReplacement,
  deleteReplacement,
} from "./db.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("unfurl-add")
    .setDescription("Add a new domain replacement rule")
    .addStringOption((opt) =>
      opt.setName("source_domain").setDescription("Domain to match (e.g., www.instagram.com)").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("target_domain").setDescription("Replacement domain (e.g., vxinstagram.com)").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("unfurl-update")
    .setDescription("Update an existing domain replacement rule")
    .addStringOption((opt) =>
      opt.setName("source_domain").setDescription("Domain to update").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("target_domain").setDescription("New replacement domain").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("unfurl-delete")
    .setDescription("Delete a domain replacement rule")
    .addStringOption((opt) =>
      opt.setName("source_domain").setDescription("Domain to remove").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("unfurl-list")
    .setDescription("List all domain replacement rules"),
];

export async function registerCommands(token: string, clientId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), {
    body: commands.map((c) => c.toJSON()),
  });
  console.log("Slash commands registered.");
}

function messageLink(interaction: ChatInputCommandInteraction): string | null {
  if (!interaction.guildId) return null;
  return `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${interaction.id}`;
}

export async function handleInteraction(
  interaction: ChatInputCommandInteraction,
  db: Database.Database
): Promise<void> {
  const { commandName } = interaction;

  if (commandName === "unfurl-add") {
    const sourceDomain = interaction.options.getString("source_domain", true);
    const targetDomain = interaction.options.getString("target_domain", true);

    const existing = getReplacement(db, sourceDomain);
    if (existing) {
      await interaction.reply({
        content: `\`${sourceDomain}\` already exists (→ \`${existing.target_domain}\`). Use \`/unfurl-update\` to change it.`,
        ephemeral: true,
      });
      return;
    }

    addReplacement(db, {
      sourceDomain,
      targetDomain,
      addedById: interaction.user.id,
      addedByName: interaction.user.username,
      messageLink: messageLink(interaction),
    });
    await interaction.reply(`Added: \`${sourceDomain}\` → \`${targetDomain}\``);
  } else if (commandName === "unfurl-update") {
    const sourceDomain = interaction.options.getString("source_domain", true);
    const targetDomain = interaction.options.getString("target_domain", true);

    const existing = getReplacement(db, sourceDomain);
    if (!existing) {
      await interaction.reply({
        content: `\`${sourceDomain}\` doesn't exist. Use \`/unfurl-add\` to create it.`,
        ephemeral: true,
      });
      return;
    }

    const oldTarget = existing.target_domain;
    updateReplacement(db, {
      sourceDomain,
      targetDomain,
      updatedById: interaction.user.id,
      updatedByName: interaction.user.username,
      messageLink: messageLink(interaction),
    });
    await interaction.reply(`Updated: \`${sourceDomain}\` → \`${targetDomain}\` (was \`${oldTarget}\`)`);
  } else if (commandName === "unfurl-delete") {
    const sourceDomain = interaction.options.getString("source_domain", true);

    const deleted = deleteReplacement(db, sourceDomain);
    if (!deleted) {
      await interaction.reply({
        content: `\`${sourceDomain}\` doesn't exist.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply(`Deleted: \`${sourceDomain}\` → \`${deleted.target_domain}\``);
  } else if (commandName === "unfurl-list") {
    const all = getAllReplacements(db);
    if (all.length === 0) {
      await interaction.reply("No replacement rules configured.");
      return;
    }

    const lines = all.map(
      (r) => `\`${r.source_domain}\` → \`${r.target_domain}\` (added by ${r.added_by_name})`
    );
    await interaction.reply(lines.join("\n"));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/commands.ts
git commit -m "feat: implement slash command definitions and handlers"
```

---

### Task 7: Command handler tests

**Files:**
- Create: `tests/commands.test.ts`

- [ ] **Step 1: Write tests for command handlers**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { createDb, addReplacement } from "../src/db.js";
import { handleInteraction } from "../src/commands.js";

function mockInteraction(overrides: {
  commandName: string;
  options?: Record<string, string>;
  userId?: string;
  username?: string;
  guildId?: string;
  channelId?: string;
}) {
  const replies: { content: string; ephemeral?: boolean }[] = [];
  return {
    commandName: overrides.commandName,
    options: {
      getString: (name: string, _required?: boolean) =>
        overrides.options?.[name] ?? null,
    },
    user: {
      id: overrides.userId ?? "123",
      username: overrides.username ?? "testuser",
    },
    guildId: overrides.guildId ?? "guild1",
    channelId: overrides.channelId ?? "chan1",
    id: "interaction1",
    replied: false,
    deferred: false,
    reply: vi.fn(async (content: string | { content: string; ephemeral?: boolean }) => {
      if (typeof content === "string") {
        replies.push({ content });
      } else {
        replies.push(content);
      }
    }),
    _replies: replies,
  } as any;
}

describe("handleInteraction", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  describe("unfurl-add", () => {
    it("adds a new replacement", async () => {
      const interaction = mockInteraction({
        commandName: "unfurl-add",
        options: { source_domain: "x.com", target_domain: "girlcockx.com" },
      });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        "Added: `x.com` → `girlcockx.com`"
      );
    });

    it("rejects duplicate source_domain", async () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const interaction = mockInteraction({
        commandName: "unfurl-add",
        options: { source_domain: "x.com", target_domain: "other.com" },
      });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });

  describe("unfurl-update", () => {
    it("updates an existing replacement", async () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const interaction = mockInteraction({
        commandName: "unfurl-update",
        options: { source_domain: "x.com", target_domain: "newdomain.com" },
      });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        "Updated: `x.com` → `newdomain.com` (was `girlcockx.com`)"
      );
    });

    it("rejects non-existent source_domain", async () => {
      const interaction = mockInteraction({
        commandName: "unfurl-update",
        options: { source_domain: "nope.com", target_domain: "new.com" },
      });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });

  describe("unfurl-delete", () => {
    it("deletes an existing replacement", async () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const interaction = mockInteraction({
        commandName: "unfurl-delete",
        options: { source_domain: "x.com" },
      });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        "Deleted: `x.com` → `girlcockx.com`"
      );
    });

    it("rejects non-existent source_domain", async () => {
      const interaction = mockInteraction({
        commandName: "unfurl-delete",
        options: { source_domain: "nope.com" },
      });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ ephemeral: true })
      );
    });
  });

  describe("unfurl-list", () => {
    it("lists all replacements", async () => {
      addReplacement(db, {
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const interaction = mockInteraction({ commandName: "unfurl-list" });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("x.com")
      );
    });

    it("reports when no replacements exist", async () => {
      const interaction = mockInteraction({ commandName: "unfurl-list" });
      await handleInteraction(interaction, db);
      expect(interaction.reply).toHaveBeenCalledWith(
        "No replacement rules configured."
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npx vitest run tests/commands.test.ts
```

Expected: All tests PASS (since `commands.ts` was implemented in Task 6).

- [ ] **Step 3: Commit**

```bash
git add tests/commands.test.ts
git commit -m "test: add command handler tests"
```

---

### Task 8: Bot entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement index.ts**

```typescript
import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { createDb, getReplacement } from "./db.js";
import { extractUrls, replaceUrl } from "./unfurl.js";
import { registerCommands, handleInteraction } from "./commands.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN is required");
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH ?? "./unfurl.db";
const db = createDb(dbPath);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await registerCommands(token, readyClient.user.id);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const urls = extractUrls(message.content);
  if (urls.length === 0) return;

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const rule = getReplacement(db, parsed.hostname);
      if (rule) {
        const replaced = replaceUrl(url, rule.source_domain, rule.target_domain);
        if (replaced) {
          await message.channel.send(replaced);
        }
      }
    } catch (err) {
      console.error("Failed to process URL:", err);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleInteraction(interaction, db);
  } catch (err) {
    console.error("Command error:", err);
    const reply = { content: "An error occurred.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.login(token);
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: implement bot entry point with message and interaction handlers"
```

---

### Task 9: Manual smoke test

> No commit needed — manual verification only.

- [ ] **Step 1: Set up Discord bot**

1. Go to Discord Developer Portal, create an application
2. Create a bot, copy the token
3. Enable "Message Content Intent" in bot settings
4. Generate an invite URL with `bot` and `applications.commands` scopes, and `Send Messages` + `Read Message History` permissions
5. Invite bot to a test server

- [ ] **Step 2: Configure and run**

```bash
cp .env.example .env
# Edit .env with your bot token
npm start
```

Expected: Bot logs in and registers commands.

- [ ] **Step 3: Test slash commands**

1. `/unfurl-add source_domain:www.instagram.com target_domain:vxinstagram.com` — should confirm
2. `/unfurl-add source_domain:x.com target_domain:girlcockx.com` — should confirm
3. `/unfurl-list` — should show both rules
4. Post a message with `https://www.instagram.com/p/ABC123/` — bot should reply with `https://vxinstagram.com/p/ABC123/`
5. Post a message with `https://x.com/user/status/123` — bot should reply with `https://girlcockx.com/user/status/123`
6. `/unfurl-update source_domain:x.com target_domain:fixupx.com` — should confirm with old value
7. `/unfurl-delete source_domain:x.com` — should confirm
8. `/unfurl-list` — should show only instagram rule
