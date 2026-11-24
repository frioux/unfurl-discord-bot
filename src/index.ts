import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { createDb, getReplacement } from "./db.ts";
import { extractUrls, replaceUrl } from "./unfurl.ts";
import { registerCommands, handleInteraction } from "./commands.ts";

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
  try {
    await registerCommands(token, readyClient.user.id);
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const urls = extractUrls(message.content);
  if (urls.length === 0) return;

  if (!message.guildId) return;

  let sentAny = false;
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const rule = getReplacement(db, message.guildId, parsed.hostname);
      if (rule) {
        const replaced = replaceUrl(url, rule.source_domain, rule.target_domain);
        if (replaced) {
          await message.channel.send(replaced);
          sentAny = true;
        }
      }
    } catch (err) {
      console.error("Failed to process URL:", err);
    }
  }

  if (sentAny) {
    try {
      await message.suppressEmbeds(true);
    } catch (err) {
      console.error("Failed to suppress embeds:", err);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleInteraction(interaction, db);
  } catch (err) {
    const ageMs = Date.now() - interaction.createdTimestamp;
    console.error(`Command error (/${interaction.commandName}, interaction age ${ageMs}ms):`, err);
    const reply = { content: "An error occurred.", flags: MessageFlags.Ephemeral } as const;
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (replyErr) {
      console.error("Failed to send error reply:", replyErr);
    }
  }
});

client.on(Events.Error, (err) => {
  console.error("Client error:", err);
});

client.login(token).catch((err) => {
  console.error("Failed to login:", err);
  process.exit(1);
});
