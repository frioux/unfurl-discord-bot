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
