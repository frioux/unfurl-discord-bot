import Database from "better-sqlite3";

const dbPath = process.argv[2] ?? "./unfurl.db";
const guildId = "388773739476549633";

const db = new Database(dbPath);
const result = db.prepare("UPDATE replacements SET guild_id = ? WHERE guild_id = ''").run(guildId);
console.log(`Updated ${result.changes} rows with guild_id ${guildId}`);
db.close();
