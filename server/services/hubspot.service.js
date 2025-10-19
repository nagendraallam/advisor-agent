import { Client } from "@hubspot/api-client";
import Contact from "../models/Contact.js";
import Note from "../models/Note.js";
import SyncStatus from "../models/SyncStatus.js";

/**
 * Initialize HubSpot client with user's access token
 */
const getHubSpotClient = (accessToken) => {
  return new Client({ accessToken });
};

/**
 * Fetch all contacts from HubSpot
 */
export const fetchAllContacts = async (user) => {
  try {
    console.log(`Fetching HubSpot contacts for user ${user.email}...`);

    const hubspotClient = getHubSpotClient(user.hubspotAccessToken);
    const contacts = [];
    let after = undefined;

    // Paginate through all contacts
    do {
      const response = await hubspotClient.crm.contacts.basicApi.getPage(
        100, // limit
        after, // pagination cursor
        [
          "email",
          "firstname",
          "lastname",
          "phone",
          "company",
          "jobtitle",
          "city",
          "state",
          "country",
        ] // properties to fetch
      );

      contacts.push(...response.results);
      after = response.paging?.next?.after;
    } while (after);

    console.log(`Found ${contacts.length} contacts`);

    // Store contacts in database
    for (const contact of contacts) {
      try {
        const contactData = {
          userId: user.id,
          hubspotId: contact.id,
          email: contact.properties.email || null,
          name:
            [contact.properties.firstname, contact.properties.lastname]
              .filter(Boolean)
              .join(" ") || "Unknown",
          properties: contact.properties,
        };

        await Contact.upsert(contactData, {
          conflictFields: ["user_id", "hubspot_id"],
        });
      } catch (error) {
        console.error(`Error saving contact ${contact.id}:`, error.message);
      }
    }

    console.log(`✅ Successfully synced ${contacts.length} contacts`);
    return contacts.length;
  } catch (error) {
    console.error("Error fetching contacts:", error);
    throw error;
  }
};

/**
 * Fetch all notes associated with contacts
 */
export const fetchAllNotes = async (user) => {
  try {
    console.log(`Fetching HubSpot notes for user ${user.email}...`);

    const hubspotClient = getHubSpotClient(user.hubspotAccessToken);
    const notes = [];
    let after = undefined;

    // Paginate through all notes
    do {
      const response = await hubspotClient.crm.objects.notes.basicApi.getPage(
        100, // limit
        after, // pagination cursor
        ["hs_note_body", "hs_timestamp", "hs_lastmodifieddate"] // properties
      );

      notes.push(...response.results);
      after = response.paging?.next?.after;
    } while (after);

    console.log(`Found ${notes.length} notes`);

    // For each note, get associated contacts
    for (const note of notes) {
      try {
        // Get associations between note and contacts
        const associations =
          await hubspotClient.crm.objects.notes.associationsApi.getAll(
            note.id,
            "contacts"
          );

        const associatedContactIds = associations.results.map(
          (assoc) => assoc.toObjectId
        );

        // Find the first associated contact in our database
        let contactId = null;
        if (associatedContactIds.length > 0) {
          const contact = await Contact.findOne({
            where: {
              userId: user.id,
              hubspotId: associatedContactIds[0],
            },
          });
          contactId = contact ? contact.id : null;
        }

        const noteData = {
          userId: user.id,
          hubspotId: note.id,
          contactId: contactId,
          body: note.properties.hs_note_body || "",
        };

        await Note.upsert(noteData, {
          conflictFields: ["hubspot_id"],
        });
      } catch (error) {
        console.error(`Error saving note ${note.id}:`, error.message);
      }
    }

    console.log(`✅ Successfully synced ${notes.length} notes`);
    return notes.length;
  } catch (error) {
    console.error("Error fetching notes:", error);
    throw error;
  }
};

/**
 * Sync HubSpot data for a user (contacts + notes)
 */
export const syncHubSpotForUser = async (user) => {
  try {
    // Update sync status to in_progress
    await SyncStatus.upsert({
      userId: user.id,
      source: "hubspot",
      status: "in_progress",
      lastSyncAt: new Date(),
    });

    const contactCount = await fetchAllContacts(user);
    const noteCount = await fetchAllNotes(user);

    // Update sync status to success
    await SyncStatus.upsert({
      userId: user.id,
      source: "hubspot",
      status: "success",
      lastSyncAt: new Date(),
      errorMessage: null,
    });

    return {
      success: true,
      contactCount,
      noteCount,
    };
  } catch (error) {
    // Update sync status to error
    await SyncStatus.upsert({
      userId: user.id,
      source: "hubspot",
      status: "error",
      lastSyncAt: new Date(),
      errorMessage: error.message,
    });

    throw error;
  }
};

export default {
  fetchAllContacts,
  fetchAllNotes,
  syncHubSpotForUser,
};
