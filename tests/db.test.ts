import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDb, addReplacement, getReplacement, getAllReplacements, updateReplacement, deleteReplacement } from "../src/db.ts";
import type { DatabaseSync } from "node:sqlite";

describe("db", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  describe("createDb", () => {
    it("creates the replacements table", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='replacements'")
        .all();
      assert.equal(tables.length, 1);
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
      assert.equal(result.guild_id, "guild1");
      assert.equal(result.source_domain, "www.instagram.com");
      assert.equal(result.target_domain, "vxinstagram.com");
      assert.equal(result.added_by_id, "123");
      assert.equal(result.added_by_name, "testuser");
      assert.ok(result.added_at);
      assert.equal(result.message_link, "https://discord.com/channels/1/2/3");
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
      assert.throws(() =>
        addReplacement(db, {
          guildId: "guild1",
          sourceDomain: "x.com",
          targetDomain: "other.com",
          addedById: "456",
          addedByName: "otheruser",
          messageLink: null,
        })
      );
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
      assert.equal(result.guild_id, "guild2");
      assert.equal(result.target_domain, "other.com");
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
      assert.notEqual(result, undefined);
      assert.equal(result!.target_domain, "girlcockx.com");
    });

    it("returns undefined for non-existent domain", () => {
      const result = getReplacement(db, "guild1", "nonexistent.com");
      assert.equal(result, undefined);
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
      assert.equal(result, undefined);
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
      assert.equal(results.length, 2);
    });

    it("returns empty array when no replacements exist", () => {
      const results = getAllReplacements(db, "guild1");
      assert.equal(results.length, 0);
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
      assert.notEqual(result, undefined);
      assert.equal(result!.target_domain, "newdomain.com");
      assert.equal(result!.updated_by_id, "456");
      assert.equal(result!.updated_by_name, "updater");
      assert.ok(result!.updated_at);
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
      assert.equal(result, undefined);
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
      assert.notEqual(result, undefined);
      assert.equal(result!.source_domain, "x.com");
      assert.equal(getReplacement(db, "guild1", "x.com"), undefined);
    });

    it("returns undefined for non-existent domain", () => {
      const result = deleteReplacement(db, "guild1", "nonexistent.com");
      assert.equal(result, undefined);
    });
  });
});
