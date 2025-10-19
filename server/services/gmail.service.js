import { google } from "googleapis";
import Email from "../models/Email.js";
import SyncStatus from "../models/SyncStatus.js";

/**
 * Initialize Gmail client with user's access token
 */
const getGmailClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
};

/**
 * Decode base64url email content
 */
const decodeBase64Url = (str) => {
  if (!str) return "";
  try {
    return Buffer.from(str, "base64url").toString("utf-8");
  } catch (error) {
    console.error("Error decoding base64:", error);
    return "";
  }
};

/**
 * Parse email headers
 */
const parseHeaders = (headers) => {
  const headerMap = {};
  headers.forEach((header) => {
    headerMap[header.name.toLowerCase()] = header.value;
  });
  return headerMap;
};

/**
 * Extract email body from payload
 */
const extractBody = (payload) => {
  let bodyText = "";
  let bodyHtml = "";

  // Handle single part messages
  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
  }

  // Handle multipart messages
  if (payload.parts) {
    payload.parts.forEach((part) => {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        bodyText = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body && part.body.data) {
        bodyHtml = decodeBase64Url(part.body.data);
      }
      // Recursive for nested parts
      if (part.parts) {
        const nested = extractBody(part);
        if (!bodyText) bodyText = nested.bodyText;
        if (!bodyHtml) bodyHtml = nested.bodyHtml;
      }
    });
  }

  return { bodyText, bodyHtml };
};

/**
 * Parse email addresses from header
 */
const parseEmailAddresses = (addressString) => {
  if (!addressString) return [];

  // Simple email extraction - matches email@domain.com
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = addressString.match(emailRegex);
  return matches || [];
};

/**
 * Parse "From" header to extract name and email
 */
const parseFromHeader = (fromString) => {
  if (!fromString) return { name: "", email: "" };

  // Format: "Name <email@domain.com>" or just "email@domain.com"
  const match = fromString.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1] ? match[1].trim() : "",
      email: match[2] ? match[2].trim() : fromString,
    };
  }

  return { name: "", email: fromString };
};

/**
 * Fetch emails from the last N days
 */
export const fetchRecentEmails = async (user, daysBack = 2) => {
  try {
    console.log(
      `Fetching emails for user ${user.email} (last ${daysBack} days)...`
    );

    const gmail = getGmailClient(user.googleAccessToken);

    // Calculate date for query
    const dateAfter = new Date();
    dateAfter.setDate(dateAfter.getDate() - daysBack);
    const dateString = dateAfter.toISOString().split("T")[0].replace(/-/g, "/");

    // List messages with date filter
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `after:${dateString}`,
      maxResults: 500, // Adjust as needed
    });

    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} messages`);

    const emailsData = [];

    // Fetch each message details
    for (const message of messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full",
        });

        const payload = detail.data.payload;
        const headers = parseHeaders(payload.headers);
        const { bodyText, bodyHtml } = extractBody(payload);
        const fromParsed = parseFromHeader(headers["from"]);
        const toEmails = parseEmailAddresses(headers["to"]);

        const emailData = {
          userId: user.id,
          messageId: detail.data.id,
          subject: headers["subject"] || "(no subject)",
          fromEmail: fromParsed.email,
          fromName: fromParsed.name,
          toEmails: toEmails,
          bodyText: bodyText.substring(0, 10000), // Limit body size
          bodyHtml: bodyHtml.substring(0, 10000),
          date: new Date(parseInt(detail.data.internalDate)),
          labels: detail.data.labelIds || [],
          metadata: {
            threadId: detail.data.threadId,
            snippet: detail.data.snippet,
          },
        };

        emailsData.push(emailData);
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error.message);
      }
    }

    // Bulk insert/update emails
    for (const emailData of emailsData) {
      try {
        await Email.upsert(emailData, {
          conflictFields: ["message_id"],
        });
      } catch (error) {
        console.error(
          `Error saving email ${emailData.messageId}:`,
          error.message
        );
      }
    }

    console.log(`✅ Successfully synced ${emailsData.length} emails`);
    return emailsData.length;
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
};

/**
 * Sync Gmail emails for a user
 */
export const syncGmailForUser = async (user) => {
  try {
    // Update sync status to in_progress
    await SyncStatus.upsert({
      userId: user.id,
      source: "gmail",
      status: "in_progress",
      lastSyncAt: new Date(),
    });

    const count = await fetchRecentEmails(user, 2);

    // Update sync status to success
    await SyncStatus.upsert({
      userId: user.id,
      source: "gmail",
      status: "success",
      lastSyncAt: new Date(),
      errorMessage: null,
    });

    return { success: true, count };
  } catch (error) {
    // Update sync status to error
    await SyncStatus.upsert({
      userId: user.id,
      source: "gmail",
      status: "error",
      lastSyncAt: new Date(),
      errorMessage: error.message,
    });

    throw error;
  }
};

/**
 * Fetch emails with custom query (for monitoring service)
 * Returns the actual email records, not just the count
 */
export const fetchEmails = async (user, options = {}) => {
  try {
    const { query = "", maxResults = 50 } = options;

    console.log(`Fetching emails for ${user.email} with query: "${query}"`);

    const gmail = getGmailClient(user.googleAccessToken);

    // List messages with query
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    const messages = response.data.messages || [];
    console.log(`Found ${messages.length} message(s)`);

    const emailRecords = [];

    // Fetch each message details
    for (const message of messages) {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full",
        });

        const payload = detail.data.payload;
        const headers = parseHeaders(payload.headers);
        const { bodyText, bodyHtml } = extractBody(payload);
        const fromParsed = parseFromHeader(headers["from"]);
        const toEmails = parseEmailAddresses(headers["to"]);

        const emailData = {
          userId: user.id,
          messageId: detail.data.id,
          subject: headers["subject"] || "(no subject)",
          fromEmail: fromParsed.email,
          fromName: fromParsed.name,
          toEmails: toEmails,
          bodyText: bodyText.substring(0, 10000),
          bodyHtml: bodyHtml.substring(0, 10000),
          date: new Date(parseInt(detail.data.internalDate)),
          labels: detail.data.labelIds || [],
          metadata: {
            threadId: detail.data.threadId,
            snippet: detail.data.snippet,
          },
        };

        // Save to database
        const [emailRecord] = await Email.upsert(emailData, {
          conflictFields: ["message_id"],
          returning: true,
        });

        emailRecords.push(emailRecord);
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error.message);
      }
    }

    return emailRecords;
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
};

export default {
  fetchRecentEmails,
  syncGmailForUser,
  fetchEmails,
};
