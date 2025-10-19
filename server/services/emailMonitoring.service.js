import { User, Email, Contact } from "../models/index.js";
import { fetchEmails } from "./gmail.service.js";
import {
  matchEmailToTasks,
  completeTask,
  postTaskCompletionToChat,
} from "./task.service.js";
import { generateResponse } from "./llm.service.js";
import { query } from "../config/postgres.js";
import axios from "axios";

const MONITORING_INTERVAL_MS =
  (process.env.EMAIL_MONITORING_INTERVAL_MINUTES || 10) * 60 * 1000;
const AUTO_CREATE_CONTACTS = process.env.AUTO_CREATE_CONTACTS !== "false"; // Default true

let monitoringInterval = null;
let isRunning = false;

/**
 * Check if sender email exists in contacts
 */
const checkSenderInContacts = async (email, userId) => {
  try {
    const contact = await Contact.findOne({
      where: {
        userId,
        email: email.toLowerCase(),
      },
    });

    return contact !== null;
  } catch (error) {
    console.error("Error checking sender in contacts:", error);
    return false;
  }
};

/**
 * Extract contact info from email using AI
 */
const extractContactInfoFromEmail = async (email) => {
  try {
    const emailContent = `
From: ${email.fromName || email.fromEmail}
Email: ${email.fromEmail}
Subject: ${email.subject}
Date: ${email.date}

Body:
${
  email.body_text?.substring(0, 1000) ||
  email.body_html?.substring(0, 1000) ||
  "No content"
}
    `.trim();

    const prompt = `Extract contact information and generate a brief professional note from this email.

${emailContent}

Return a JSON object with:
{
  "firstname": "extracted first name (if found)",
  "lastname": "extracted last name (if found)",
  "company": "extracted company name (if found)",
  "jobtitle": "extracted job title (if found)",
  "phone": "extracted phone (if found)",
  "note": "2-3 sentence professional summary about this person and why they reached out"
}

If information is not found, use empty string. Be concise and professional.

JSON:`;

    const response = await generateResponse(prompt, { temperature: 0.3 });

    // Try to parse JSON from response
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const contactInfo = JSON.parse(jsonMatch[0]);
      return contactInfo;
    }

    // Fallback if JSON parsing fails
    return {
      firstname: email.fromName?.split(" ")[0] || "",
      lastname: email.fromName?.split(" ").slice(1).join(" ") || "",
      company: "",
      jobtitle: "",
      phone: "",
      note: `${email.fromName || email.fromEmail} reached out regarding: ${
        email.subject
      }`,
    };
  } catch (error) {
    console.error("Error extracting contact info:", error);

    // Return basic info if AI extraction fails
    return {
      firstname: email.fromName?.split(" ")[0] || "",
      lastname: email.fromName?.split(" ").slice(1).join(" ") || "",
      company: "",
      jobtitle: "",
      phone: "",
      note: `${email.fromName || email.fromEmail} reached out regarding: ${
        email.subject
      }`,
    };
  }
};

/**
 * Create contact in HubSpot and local database
 */
const createContactFromEmail = async (email, userId, user) => {
  try {
    console.log(`📝 Creating new contact for: ${email.fromEmail}`);

    // Extract contact info using AI
    const contactInfo = await extractContactInfoFromEmail(email);

    // Create in HubSpot if connected
    let hubspotContactId = null;
    if (user.hubspotAccessToken) {
      try {
        const hubspotResponse = await axios.post(
          "https://api.hubapi.com/crm/v3/objects/contacts",
          {
            properties: {
              email: email.fromEmail,
              firstname: contactInfo.firstname,
              lastname: contactInfo.lastname,
              company: contactInfo.company,
              jobtitle: contactInfo.jobtitle,
              phone: contactInfo.phone,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${user.hubspotAccessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        hubspotContactId = hubspotResponse.data.id;

        // Create note in HubSpot
        if (contactInfo.note) {
          await axios.post(
            "https://api.hubapi.com/crm/v3/objects/notes",
            {
              properties: {
                hs_note_body: contactInfo.note,
                hs_timestamp: new Date(email.date).getTime(),
              },
              associations: [
                {
                  to: { id: hubspotContactId },
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: 202, // Note to Contact
                    },
                  ],
                },
              ],
            },
            {
              headers: {
                Authorization: `Bearer ${user.hubspotAccessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log(`📝 Created note in HubSpot for contact`);
        }

        console.log(
          `✅ Created HubSpot contact: ${hubspotContactId} for ${email.fromEmail}`
        );
      } catch (hubspotError) {
        console.error("Error creating HubSpot contact:", hubspotError.message);
        // Continue to create local contact even if HubSpot fails
      }
    }

    // Create in local database
    const contact = await Contact.create({
      userId,
      hubspotId: hubspotContactId || `local-${Date.now()}`,
      email: email.fromEmail,
      name: email.fromName || email.fromEmail,
      properties: {
        firstname: contactInfo.firstname,
        lastname: contactInfo.lastname,
        company: contactInfo.company,
        jobtitle: contactInfo.jobtitle,
        phone: contactInfo.phone,
        note: contactInfo.note,
        source: "auto_created_from_email",
        created_from_email_id: email.id,
      },
    });

    console.log(
      `✅ Created local contact: ${contact.id} for ${email.fromEmail}`
    );
    return contact;
  } catch (error) {
    console.error("Error creating contact from email:", error);
    throw error;
  }
};

/**
 * Process a single email
 */
const processEmail = async (email, user) => {
  try {
    console.log(email, user);
    console.log(`📧 Processing email from: ${email.fromEmail}`);

    // 1. Check if sender exists in contacts
    const senderExists = await checkSenderInContacts(email.fromEmail, user.id);

    if (!senderExists && AUTO_CREATE_CONTACTS) {
      console.log(`🆕 New sender detected: ${email.fromEmail}`);
      await createContactFromEmail(email, user.id, user);
    }

    // 2. Check if email matches any ongoing tasks
    const matchedTasks = await matchEmailToTasks(email, user.id);

    for (const task of matchedTasks) {
      console.log(`✅ Email matches task ${task.id}`);

      // Complete the task
      await completeTask(task.id, email.id);

      // Post notification to chat
      await postTaskCompletionToChat(task, email);
    }
  } catch (error) {
    console.error(`Error processing email ${email.id}:`, error);
    // Continue processing other emails even if one fails
  }
};

/**
 * Get last email check time for user
 */
const getLastCheckTime = async (userId) => {
  try {
    const result = await query(
      `SELECT last_check_at FROM email_monitoring_status WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].last_check_at;
    }

    // If no record exists, return 1 hour ago
    return new Date(Date.now() - 60 * 60 * 1000);
  } catch (error) {
    console.error("Error getting last check time:", error);
    return new Date(Date.now() - 60 * 60 * 1000);
  }
};

/**
 * Update last email check time for user
 */
const updateLastCheckTime = async (userId) => {
  try {
    await query(
      `INSERT INTO email_monitoring_status (user_id, last_check_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET last_check_at = NOW(), updated_at = NOW()`,
      [userId]
    );
  } catch (error) {
    console.error("Error updating last check time:", error);
  }
};

/**
 * Monitor emails for a single user
 */
const monitorUserEmails = async (user) => {
  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📬 Monitoring emails for user: ${user.email}`);
    console.log(`${"=".repeat(60)}\n`);

    // Get last check time
    const lastCheckTime = await getLastCheckTime(user.id);
    console.log(`⏰ Last check: ${lastCheckTime.toISOString()}`);

    // Fetch new emails since last check
    const query = `after:${Math.floor(lastCheckTime.getTime() / 1000)}`;
    const newEmails = await fetchEmails(user, { query, maxResults: 50 });

    console.log(`📨 Found ${newEmails.length} new email(s)`);

    if (newEmails.length === 0) {
      await updateLastCheckTime(user.id);
      return;
    }

    // Process each email
    for (const email of newEmails) {
      await processEmail(email, user);
    }

    // Update last check time
    await updateLastCheckTime(user.id);

    console.log(`✅ Completed monitoring for ${user.email}\n`);
  } catch (error) {
    console.error(`❌ Error monitoring user ${user.email}:`, error.message);
  }
};

/**
 * Main monitoring function - checks all users
 */
const monitorAllUsers = async () => {
  if (isRunning) {
    console.log("⏭️  Monitoring already in progress, skipping...");
    return;
  }

  isRunning = true;

  try {
    console.log(`\n${"🔄 EMAIL MONITORING CYCLE STARTED ".padEnd(60, "=")}`);
    console.log(`⏰ ${new Date().toISOString()}\n`);

    // Get all users with Google connected
    const users = await User.findAll({
      where: {
        googleAccessToken: { [Symbol.for("ne")]: null },
      },
    });

    console.log(`👥 Found ${users.length} user(s) with Google connected\n`);

    // Monitor each user sequentially
    for (const user of users) {
      await monitorUserEmails(user);
    }

    console.log(`${"✅ EMAIL MONITORING CYCLE COMPLETED ".padEnd(60, "=")}\n`);
  } catch (error) {
    console.error("❌ Error in monitoring cycle:", error);
  } finally {
    isRunning = false;
  }
};

/**
 * Start the email monitoring service
 */
export const startEmailMonitoring = () => {
  if (monitoringInterval) {
    console.log("⚠️  Email monitoring is already running");
    return;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Starting Email Monitoring Service`);
  console.log(
    `⏱️  Interval: ${
      process.env.EMAIL_MONITORING_INTERVAL_MINUTES || 10
    } minutes`
  );
  console.log(
    `📝 Auto-create contacts: ${AUTO_CREATE_CONTACTS ? "Enabled" : "Disabled"}`
  );
  console.log(`${"=".repeat(60)}\n`);

  // Run immediately on start
  monitorAllUsers();

  // Then run on interval
  monitoringInterval = setInterval(monitorAllUsers, MONITORING_INTERVAL_MS);

  console.log("✅ Email monitoring service started\n");
};

/**
 * Stop the email monitoring service
 */
export const stopEmailMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("🛑 Email monitoring service stopped");
  }
};

/**
 * Manually trigger monitoring (for testing/debugging)
 */
export const triggerMonitoring = async () => {
  console.log("🔄 Manually triggering email monitoring...");
  await monitorAllUsers();
};

export default {
  startEmailMonitoring,
  stopEmailMonitoring,
  triggerMonitoring,
  monitorAllUsers,
};
