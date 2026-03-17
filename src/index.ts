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
