import { DatabaseSync } from "node:sqlite";

export interface Replacement {
  id: number;
  guild_id: string;
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

// node:sqlite returns null-prototype row objects; copy into plain objects.
function toReplacement(row: unknown): Replacement | undefined {
  return row ? ({ ...(row as object) } as Replacement) : undefined;
}

export function createDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      source_domain TEXT NOT NULL,
      target_domain TEXT NOT NULL,
      added_by_id TEXT NOT NULL,
      added_by_name TEXT NOT NULL,
      added_at TEXT NOT NULL,
      updated_by_id TEXT,
      updated_by_name TEXT,
      updated_at TEXT,
      message_link TEXT,
      UNIQUE(guild_id, source_domain)
    )
  `);
  // Migration: add guild_id to old tables that lack it
  const columns = db.prepare("PRAGMA table_info(replacements)").all() as unknown as { name: string }[];
  if (!columns.some((c) => c.name === "guild_id")) {
    db.exec("ALTER TABLE replacements ADD COLUMN guild_id TEXT NOT NULL DEFAULT ''");
  }
  return db;
}

export function addReplacement(
  db: DatabaseSync,
  params: {
    guildId: string;
    sourceDomain: string;
    targetDomain: string;
    addedById: string;
    addedByName: string;
    messageLink: string | null;
  }
): Replacement {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO replacements (guild_id, source_domain, target_domain, added_by_id, added_by_name, added_at, message_link)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    params.guildId,
    params.sourceDomain,
    params.targetDomain,
    params.addedById,
    params.addedByName,
    now,
    params.messageLink
  );
  return toReplacement(db.prepare("SELECT * FROM replacements WHERE id = ?").get(info.lastInsertRowid))!;
}

export function getReplacement(db: DatabaseSync, guildId: string, sourceDomain: string): Replacement | undefined {
  return toReplacement(
    db.prepare("SELECT * FROM replacements WHERE guild_id = ? AND source_domain = ?").get(guildId, sourceDomain)
  );
}

export function getAllReplacements(db: DatabaseSync, guildId: string): Replacement[] {
  return db
    .prepare("SELECT * FROM replacements WHERE guild_id = ? ORDER BY source_domain")
    .all(guildId)
    .map((row) => toReplacement(row)!);
}

export function updateReplacement(
  db: DatabaseSync,
  params: {
    guildId: string;
    sourceDomain: string;
    targetDomain: string;
    updatedById: string;
    updatedByName: string;
    messageLink: string | null;
  }
): Replacement | undefined {
  const existing = getReplacement(db, params.guildId, params.sourceDomain);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE replacements
    SET target_domain = ?, updated_by_id = ?, updated_by_name = ?, updated_at = ?, message_link = ?
    WHERE guild_id = ? AND source_domain = ?
  `).run(
    params.targetDomain,
    params.updatedById,
    params.updatedByName,
    now,
    params.messageLink,
    params.guildId,
    params.sourceDomain
  );
  return getReplacement(db, params.guildId, params.sourceDomain);
}

export function deleteReplacement(db: DatabaseSync, guildId: string, sourceDomain: string): Replacement | undefined {
  const existing = getReplacement(db, guildId, sourceDomain);
  if (!existing) return undefined;
  db.prepare("DELETE FROM replacements WHERE guild_id = ? AND source_domain = ?").run(guildId, sourceDomain);
  return existing;
}
