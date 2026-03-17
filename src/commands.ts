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

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  if (commandName === "unfurl-add") {
    const sourceDomain = interaction.options.getString("source_domain", true);
    const targetDomain = interaction.options.getString("target_domain", true);

    const existing = getReplacement(db, guildId, sourceDomain);
    if (existing) {
      await interaction.reply({
        content: `\`${sourceDomain}\` already exists (→ \`${existing.target_domain}\`). Use \`/unfurl-update\` to change it.`,
        ephemeral: true,
      });
      return;
    }

    addReplacement(db, {
      guildId,
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

    const existing = getReplacement(db, guildId, sourceDomain);
    if (!existing) {
      await interaction.reply({
        content: `\`${sourceDomain}\` doesn't exist. Use \`/unfurl-add\` to create it.`,
        ephemeral: true,
      });
      return;
    }

    const oldTarget = existing.target_domain;
    updateReplacement(db, {
      guildId,
      sourceDomain,
      targetDomain,
      updatedById: interaction.user.id,
      updatedByName: interaction.user.username,
      messageLink: messageLink(interaction),
    });
    await interaction.reply(`Updated: \`${sourceDomain}\` → \`${targetDomain}\` (was \`${oldTarget}\`)`);
  } else if (commandName === "unfurl-delete") {
    const sourceDomain = interaction.options.getString("source_domain", true);

    const deleted = deleteReplacement(db, guildId, sourceDomain);
    if (!deleted) {
      await interaction.reply({
        content: `\`${sourceDomain}\` doesn't exist.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply(`Deleted: \`${sourceDomain}\` → \`${deleted.target_domain}\``);
  } else if (commandName === "unfurl-list") {
    const all = getAllReplacements(db, guildId);
    if (all.length === 0) {
      await interaction.reply("No replacement rules configured.");
      return;
    }

    const lines = all.map((r) => {
      const base = `\`${r.source_domain}\` → \`${r.target_domain}\` (added by ${r.added_by_name})`;
      return r.message_link ? `${base} — ${r.message_link}` : base;
    });
    await interaction.reply(lines.join("\n"));
  }
}
