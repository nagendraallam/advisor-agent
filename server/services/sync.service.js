import cron from "node-cron";
import User from "../models/User.js";
import { syncGmailForUser } from "./gmail.service.js";
import { syncHubSpotForUser } from "./hubspot.service.js";
import { generateAllEmbeddings } from "./embeddings.service.js";

const SYNC_INTERVAL_MINUTES = parseInt(
  process.env.SYNC_INTERVAL_MINUTES || "15",
  10
);

/**
 * Sync data for a single user
 */
export const syncUserData = async (user) => {
  console.log(`Starting sync for user ${user.email}...`);
  const results = {
    userId: user.id,
    gmail: null,
    hubspot: null,
    embeddings: null,
    errors: [],
  };

  try {
    // Sync Gmail if connected
    if (user.googleAccessToken) {
      try {
        console.log(`Syncing Gmail for ${user.email}...`);
        results.gmail = await syncGmailForUser(user);
      } catch (error) {
        console.error(`Gmail sync error for ${user.email}:`, error.message);
        results.errors.push({
          source: "gmail",
          message: error.message,
        });
      }
    }

    // Sync HubSpot if connected
    if (user.hubspotAccessToken) {
      try {
        console.log(`Syncing HubSpot for ${user.email}...`);
        results.hubspot = await syncHubSpotForUser(user);
      } catch (error) {
        console.error(`HubSpot sync error for ${user.email}:`, error.message);
        results.errors.push({
          source: "hubspot",
          message: error.message,
        });
      }
    }

    // Generate embeddings for new content
    try {
      console.log(`Generating embeddings for ${user.email}...`);
      results.embeddings = await generateAllEmbeddings(user.id);
    } catch (error) {
      console.error(`Embeddings error for ${user.email}:`, error.message);
      results.errors.push({
        source: "embeddings",
        message: error.message,
      });
    }

    console.log(`✅ Sync completed for ${user.email}`);
    return results;
  } catch (error) {
    console.error(`Error syncing user ${user.email}:`, error);
    throw error;
  }
};

/**
 * Sync data for all users
 */
export const syncAllUsers = async () => {
  try {
    console.log("🔄 Starting scheduled sync for all users...");

    // Find all users with connected accounts
    const users = await User.findAll({
      where: {
        // Find users with at least one connection
      },
    });

    console.log(`Found ${users.length} users to sync`);

    const results = [];
    for (const user of users) {
      // Only sync if user has at least one connection
      if (user.googleAccessToken || user.hubspotAccessToken) {
        try {
          const result = await syncUserData(user);
          results.push(result);
        } catch (error) {
          console.error(`Failed to sync user ${user.id}:`, error);
          results.push({
            userId: user.id,
            error: error.message,
          });
        }
      }
    }

    console.log(`✅ Scheduled sync completed for ${results.length} users`);
    return results;
  } catch (error) {
    console.error("Error in scheduled sync:", error);
    throw error;
  }
};

/**
 * Initialize background sync job
 */
export const initializeSyncJob = () => {
  // Run every N minutes (configurable via env)
  const cronExpression = `*/${SYNC_INTERVAL_MINUTES} * * * *`;

  console.log(
    `📅 Initializing sync job: every ${SYNC_INTERVAL_MINUTES} minutes`
  );

  const job = cron.schedule(cronExpression, async () => {
    console.log(`⏰ Running scheduled sync at ${new Date().toISOString()}`);
    try {
      await syncAllUsers();
    } catch (error) {
      console.error("Scheduled sync failed:", error);
    }
  });

  // Run initial sync after 1 minute
  setTimeout(async () => {
    console.log("Running initial sync...");
    try {
      await syncAllUsers();
    } catch (error) {
      console.error("Initial sync failed:", error);
    }
  }, 60000); // 1 minute delay

  return job;
};

/**
 * Stop sync job
 */
export const stopSyncJob = (job) => {
  if (job) {
    job.stop();
    console.log("🛑 Sync job stopped");
  }
};

export default {
  syncUserData,
  syncAllUsers,
  initializeSyncJob,
  stopSyncJob,
};
