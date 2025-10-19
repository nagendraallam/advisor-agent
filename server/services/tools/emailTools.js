import { google } from "googleapis";
import { Op } from "sequelize";
import Email from "../../models/Email.js";
import { query } from "../../config/postgres.js";

/**
 * Initialize Gmail client with user's access token
 */
const getGmailClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
};

/**
 * Search for emails in the database
 */
export async function searchEmails({ query: searchQuery, limit = 5, userId }) {
  try {
    console.log(`Searching emails for: "${searchQuery}"`);

    // Search across subject, from_name, from_email, and body_text
    const emails = await Email.findAll({
      where: {
        userId: userId,
        [Op.or]: [
          { subject: { [Op.iLike]: `%${searchQuery}%` } },
          { fromName: { [Op.iLike]: `%${searchQuery}%` } },
          { fromEmail: { [Op.iLike]: `%${searchQuery}%` } },
          { bodyText: { [Op.iLike]: `%${searchQuery}%` } },
        ],
      },
      order: [["date", "DESC"]],
      limit: limit,
      attributes: [
        "id",
        "subject",
        "fromEmail",
        "fromName",
        "date",
        "bodyText",
      ],
    });

    const results = emails.map((email) => ({
      id: email.id,
      subject: email.subject,
      from: `${email.fromName} <${email.fromEmail}>`,
      date: email.date,
      snippet: email.bodyText ? email.bodyText.substring(0, 200) + "..." : "",
    }));

    console.log(`Found ${results.length} emails`);
    return {
      success: true,
      results: results,
      count: results.length,
    };
  } catch (error) {
    console.error("Error searching emails:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Read a specific email by ID
 */
export async function readEmail({ email_id, userId }) {
  try {
    console.log(`Reading email ID: ${email_id}`);

    const email = await Email.findOne({
      where: {
        id: email_id,
        userId: userId,
      },
    });

    if (!email) {
      return {
        success: false,
        error: "Email not found",
      };
    }

    return {
      success: true,
      email: {
        id: email.id,
        subject: email.subject,
        from: `${email.fromName} <${email.fromEmail}>`,
        to: email.toEmails,
        date: email.date,
        body: email.bodyText || email.bodyHtml,
        labels: email.labels,
      },
    };
  } catch (error) {
    console.error("Error reading email:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send an email via Gmail
 */
export async function sendEmail({ to_email, to_name, subject, body, user }) {
  try {
    console.log(`Sending email to: ${to_email}`);

    if (!user.googleAccessToken) {
      return {
        success: false,
        error: "No Gmail access token available",
      };
    }

    const gmail = getGmailClient(user.googleAccessToken);

    // Create email message
    const to = to_name ? `${to_name} <${to_email}>` : to_email;
    const messageParts = [`To: ${to}`, `Subject: ${subject}`, "", body];
    const message = messageParts.join("\n");

    // Encode message in base64
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail API
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`Email sent successfully, ID: ${response.data.id}`);

    return {
      success: true,
      messageId: response.data.id,
      message: `Email sent successfully to ${to_email}`,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
