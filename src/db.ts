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
