var db = {
    initialize: function () {
        const db = require('better-sqlite3')('schedule.db')
        db.pragma('journal_mode = WAL'); //The wizards have whispered in my ear
        const sql = `CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discordId TEXT NOT NULL,
            googleId TEXT NOT NULL,
            guildId TEXT NOT NULL,
            endTime TIMESTAMP
        )`;
        db.exec(sql);
        console.log("Initialized database.");
        return db;
    },
    addEvent: function(discordId, googleId, guildId, endTime, db) {
        const sql = db.prepare('INSERT INTO events (discordId, googleId, guildId, endTime) VALUES (?,?,?,?)');
        sql.run(discordId,googleId,guildId,endTime);
    },
    googleEventExistsInDiscord: function(googleId, guildId, db) {
        const sql = db.prepare('SELECT * FROM events WHERE googleId = ? AND guildId = ?');
        const result = sql.get(googleId, guildId);
        return result ? true : false;
    },
    updateEndTimestamp: function(endTime, discordId, guildId, db) {
        const sql = db.prepare('UPDATE events SET endTime = ? WHERE discordId = ? AND guildId = ?');
        sql.run(endTime, discordId, guildId);
    },
    getDiscordId: function(googleId,guildId,db) {
        const sql = db.prepare('SELECT discordId FROM events WHERE googleId = ? AND guildId = ?');
        const result = sql.get(googleId,guildId);
        return result.discordId;
    },
    removeStaleEvents: function(timestamp,db) {
        const sql = db.prepare('DELETE FROM events WHERE endTime < ?');
        const result = sql.run(timestamp);
        if(result.changes) {
            console.log(`Removing ${result.changes} entries from the database`)
        }
    },
    getEventsForGuild: function(guildId,db) {
        const sql = db.prepare('SELECT * FROM events WHERE guildId = ?');
        const result = sql.all(guildId);
        return result;
    },
    removeDiscordEvent: function(discordEvent,guildId,db) {
        const sql = db.prepare('DELETE FROM events WHERE guildId = ? AND discordId = ?');
        const result = sql.run(guildId,discordEvent);
        if(result.changes) {
            console.log(`Removed event ${discordEvent} from the database`)
        }
    }
}

module.exports = db