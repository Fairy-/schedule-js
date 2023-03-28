//General
const process = require('process');
require('dotenv').config();
const moment = require('moment');


// Discord 
const { Client, Events, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildScheduledEvents] });
const token = process.env.DISCORD_TOKEN;

//Google
const { google } = require('googleapis');
const { privateDecrypt } = require('crypto');
const { Console } = require('console');
const calendar = google.calendar('v3');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const GOOGLE_CALENDAR_ID = process.env.calendar_id;
const auth = new google.auth.GoogleAuth({
    keyFile: './keys.json',
    scopes: SCOPES,
});

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    checkEvents();
});

// Log in to Discord with your client's token
client.login(token);

async function listEvents() {
    try {
        const authClient = await auth.getClient();
        google.options({ auth: authClient });
        const now = moment();
        const startDate = now.format();
        const endDate = now.add(30, 'days').format();
        const res = await calendar.events.list({
            calendarId: GOOGLE_CALENDAR_ID,
            timeMin: startDate,
            timeMax: endDate,
            maxResults: 5,
            singleEvents: true,
            orderBy: 'startTime',
            // fields: 'items(id,summary,start,end,description,location,extendedProperties)',
        });
        return res.data.items;
    } catch (error) {
        console.error("There was and error listing calendar events:", error);
    }
}

async function checkEvents() {
    console.log("Checking events in calendar");
    const events = await listEvents();
    const newEvents = [];
    const existingEvents = [];

    client.guilds.cache.forEach(guild => {

        console.log(`Processing events ${events.length} for guild ${guild.id}`)
        for (const event of events) {
            //Lord have mercy
            if (event.hasOwnProperty('extendedProperties') && event.extendedProperties.hasOwnProperty('private') && event.extendedProperties.private.hasOwnProperty(guild.id)) {
                existingEvents.push(event)
            } else {
                newEvents.push(event)
            }
        };
        console.log(`New events: ${newEvents.length} / Existing events: ${existingEvents.length}`)

        createEvents(newEvents, guild);
        updateEvents(existingEvents,guild);
    });

    setTimeout(checkEvents, 1000 * 10);
}

function createEvents(events, guild) {
    events.forEach(async (event) => {
        const discordEventData = {
            name: event.summary,
            scheduledStartTime: formatDatetime(event.start).toISOString(),
            scheduledEndTime: formatDatetime(event.end).toISOString(),
            description: event.description,
            entityMetadata: { location: (event.location ? event.location : "The Internet") },
            entityType: 3, //External
            privacyLevel: 2 //Only valid value
        }
        try {
            const discordEvent = await guild.scheduledEvents.create(discordEventData);
            const extendedProperties = {
                private: {
                    [guild.id]: discordEvent.id
                }
            };
            const googleEventData = {
                eventId: event.id,
                calendarId: GOOGLE_CALENDAR_ID,
                resource: {
                    extendedProperties: extendedProperties
                }
            }
            await calendar.events.patch(googleEventData);
        } catch (error) {
            console.error("There was an error in creating the Discord event:", error)
        }
    })
}

function updateEvents(events, guild) {
    events.forEach(async (event) => {
        const discordEvent = guild.scheduledEvents.cache.get(event.extendedProperties.private[guild.id]);
        if(discordEvent) {
            const updatedEvent = {};
            if(event.summary != discordEvent.name) {
                updatedEvent['name'] = event.summary;
            }
            if(formatDatetime(event.start).getTime() != discordEvent.scheduledStartTimestamp) {
                updatedEvent['scheduledStartTime'] = formatDatetime(event.start);
            }
            if(formatDatetime(event.end).getTime() != discordEvent.scheduledEndTimestamp) {
                updatedEvent['scheduledEndTime'] = formatDatetime(event.end);
            }
            if(event.description != discordEvent.description) {
                updatedEvent['description'] = event.description;
            }
            if(Object.keys(updatedEvent).length) {
                console.log(`Updating event ${event.id}`);
                await guild.scheduledEvents.edit(discordEvent,updatedEvent)
            }
        }

    })
}

function formatDatetime(dateTime) {
    return dateTime.dateTime ? new Date(dateTime.dateTime) : new Date(dateTime.date);
}