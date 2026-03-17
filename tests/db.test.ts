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
        guildId: "guild1",
        sourceDomain: "www.instagram.com",
        targetDomain: "vxinstagram.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: "https://discord.com/channels/1/2/3",
      });
      expect(result.guild_id).toBe("guild1");
      expect(result.source_domain).toBe("www.instagram.com");
      expect(result.target_domain).toBe("vxinstagram.com");
      expect(result.added_by_id).toBe("123");
      expect(result.added_by_name).toBe("testuser");
      expect(result.added_at).toBeTruthy();
      expect(result.message_link).toBe("https://discord.com/channels/1/2/3");
    });

    it("throws on duplicate source_domain in same guild", () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      expect(() =>
        addReplacement(db, {
          guildId: "guild1",
          sourceDomain: "x.com",
          targetDomain: "other.com",
          addedById: "456",
          addedByName: "otheruser",
          messageLink: null,
        })
      ).toThrow();
    });

    it("allows same source_domain in different guilds", () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = addReplacement(db, {
        guildId: "guild2",
        sourceDomain: "x.com",
        targetDomain: "other.com",
        addedById: "456",
        addedByName: "otheruser",
        messageLink: null,
      });
      expect(result.guild_id).toBe("guild2");
      expect(result.target_domain).toBe("other.com");
    });
  });

  describe("getReplacement", () => {
    it("returns a replacement by guild and source_domain", () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = getReplacement(db, "guild1", "x.com");
      expect(result).not.toBeUndefined();
      expect(result!.target_domain).toBe("girlcockx.com");
    });

    it("returns undefined for non-existent domain", () => {
      const result = getReplacement(db, "guild1", "nonexistent.com");
      expect(result).toBeUndefined();
    });

    it("does not return replacements from other guilds", () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = getReplacement(db, "guild2", "x.com");
      expect(result).toBeUndefined();
    });
  });

  describe("getAllReplacements", () => {
    it("returns all replacements for a guild", () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "www.instagram.com",
        targetDomain: "vxinstagram.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      addReplacement(db, {
        guildId: "guild2",
        sourceDomain: "x.com",
        targetDomain: "other.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const results = getAllReplacements(db, "guild1");
      expect(results).toHaveLength(2);
    });

    it("returns empty array when no replacements exist", () => {
      const results = getAllReplacements(db, "guild1");
      expect(results).toHaveLength(0);
    });
  });

  describe("updateReplacement", () => {
    it("updates the target_domain and tracking fields", () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = updateReplacement(db, {
        guildId: "guild1",
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
        guildId: "guild1",
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
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const result = deleteReplacement(db, "guild1", "x.com");
      expect(result).not.toBeUndefined();
      expect(result!.source_domain).toBe("x.com");
      expect(getReplacement(db, "guild1", "x.com")).toBeUndefined();
    });

    it("returns undefined for non-existent domain", () => {
      const result = deleteReplacement(db, "guild1", "nonexistent.com");
      expect(result).toBeUndefined();
    });
  });
});
