import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import type { DatabaseSync } from "node:sqlite";
import { createDb, addReplacement } from "../src/db.ts";
import { handleInteraction } from "../src/commands.ts";

function mockInteraction(overrides: {
  commandName: string;
  options?: Record<string, string>;
  userId?: string;
  username?: string;
  guildId?: string | null;
  channelId?: string;
}) {
  const replies: { content: string; flags?: number }[] = [];
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
    guildId: overrides.guildId === undefined ? "guild1" : overrides.guildId,
    channelId: overrides.channelId ?? "chan1",
    id: "interaction1",
    replied: false,
    deferred: false,
    reply: mock.fn(async (content: string | { content: string; flags?: number }) => {
      if (typeof content === "string") {
        replies.push({ content });
      } else {
        replies.push(content);
      }
    }),
    _replies: replies,
  } as any;
}

function firstReplyArg(interaction: any): any {
  assert.equal(interaction.reply.mock.callCount(), 1);
  return interaction.reply.mock.calls[0].arguments[0];
}

function assertEphemeralReply(interaction: any): void {
  const arg = firstReplyArg(interaction);
  assert.equal(typeof arg, "object");
  assert.equal(arg.flags, MessageFlags.Ephemeral);
}

describe("handleInteraction", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("rejects commands outside a guild", async () => {
    const interaction = mockInteraction({
      commandName: "unfurl-list",
      guildId: null,
    });
    await handleInteraction(interaction, db);
    assertEphemeralReply(interaction);
  });

  describe("unfurl-add", () => {
    it("adds a new replacement", async () => {
      const interaction = mockInteraction({
        commandName: "unfurl-add",
        options: { source_domain: "x.com", target_domain: "girlcockx.com" },
      });
      await handleInteraction(interaction, db);
      assert.equal(firstReplyArg(interaction), "Added: `x.com` → `girlcockx.com`");
    });

    it("rejects duplicate source_domain in same guild", async () => {
      addReplacement(db, {
        guildId: "guild1",
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
      assertEphemeralReply(interaction);
    });
  });

  describe("unfurl-update", () => {
    it("updates an existing replacement", async () => {
      addReplacement(db, {
        guildId: "guild1",
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
      assert.equal(firstReplyArg(interaction), "Updated: `x.com` → `newdomain.com` (was `girlcockx.com`)");
    });

    it("rejects non-existent source_domain", async () => {
      const interaction = mockInteraction({
        commandName: "unfurl-update",
        options: { source_domain: "nope.com", target_domain: "new.com" },
      });
      await handleInteraction(interaction, db);
      assertEphemeralReply(interaction);
    });
  });

  describe("unfurl-delete", () => {
    it("deletes an existing replacement", async () => {
      addReplacement(db, {
        guildId: "guild1",
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
      assert.equal(firstReplyArg(interaction), "Deleted: `x.com` → `girlcockx.com`");
    });

    it("rejects non-existent source_domain", async () => {
      const interaction = mockInteraction({
        commandName: "unfurl-delete",
        options: { source_domain: "nope.com" },
      });
      await handleInteraction(interaction, db);
      assertEphemeralReply(interaction);
    });
  });

  describe("unfurl-list", () => {
    it("lists all replacements", async () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: null,
      });
      const interaction = mockInteraction({ commandName: "unfurl-list" });
      await handleInteraction(interaction, db);
      assert.ok(firstReplyArg(interaction).includes("x.com"));
    });

    it("includes message link when available", async () => {
      addReplacement(db, {
        guildId: "guild1",
        sourceDomain: "x.com",
        targetDomain: "girlcockx.com",
        addedById: "123",
        addedByName: "testuser",
        messageLink: "https://discord.com/channels/1/2/3",
      });
      const interaction = mockInteraction({ commandName: "unfurl-list" });
      await handleInteraction(interaction, db);
      assert.ok(firstReplyArg(interaction).includes("https://discord.com/channels/1/2/3"));
    });

    it("reports when no replacements exist", async () => {
      const interaction = mockInteraction({ commandName: "unfurl-list" });
      await handleInteraction(interaction, db);
      assert.equal(firstReplyArg(interaction), "No replacement rules configured.");
    });
  });
});
