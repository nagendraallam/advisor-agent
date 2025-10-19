import OpenAI from "openai";
import { query } from "../config/postgres.js";
import Email from "../models/Email.js";
import Contact from "../models/Contact.js";
import Note from "../models/Note.js";

// Lazy initialization - create client when first needed
let openai = null;
const getOpenAIClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

/**
 * Generate embedding for a single text using OpenAI
 */
export const generateEmbedding = async (text) => {
  if (!text || text.trim().length === 0) {
    return null;
  }

  try {
    // Truncate text to avoid token limits (8191 tokens for text-embedding-3-small)
    const truncatedText = text.substring(0, 8000);

    const response = await getOpenAIClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    });

    if (response.data && response.data[0] && response.data[0].embedding) {
      return response.data[0].embedding;
    }

    return null;
  } catch (error) {
    console.error("Error generating embedding:", error.message);
    throw error;
  }
};

/**
 * Convert array to PostgreSQL vector format
 */
const arrayToVector = (arr) => {
  if (!arr || arr.length === 0) return null;
  return `[${arr.join(",")}]`;
};

/**
 * Generate embeddings for all emails without embeddings
 */
export const generateEmailEmbeddings = async (userId = null) => {
  try {
    console.log("Generating embeddings for emails...");

    // Find emails without embeddings
    const whereClause = userId
      ? { userId, embedding: null }
      : { embedding: null };
    const emails = await Email.findAll({
      where: whereClause,
      limit: 100, // Process in batches
    });

    console.log(`Found ${emails.length} emails without embeddings`);

    let successCount = 0;
    for (const email of emails) {
      try {
        // Combine subject and body for embedding
        const textToEmbed = `${email.subject || ""}\n\n${email.bodyText || ""}`;
        const embedding = await generateEmbedding(textToEmbed);

        if (embedding) {
          // Update using raw query for vector type
          await query(
            "UPDATE emails SET embedding = $1::vector WHERE id = $2",
            [arrayToVector(embedding), email.id]
          );
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error.message);
      }
    }

    console.log(`✅ Generated embeddings for ${successCount} emails`);
    return successCount;
  } catch (error) {
    console.error("Error generating email embeddings:", error);
    throw error;
  }
};

/**
 * Generate embeddings for all contacts without embeddings
 */
export const generateContactEmbeddings = async (userId = null) => {
  try {
    console.log("Generating embeddings for contacts...");

    const whereClause = userId
      ? { userId, embedding: null }
      : { embedding: null };
    const contacts = await Contact.findAll({
      where: whereClause,
      limit: 100,
    });

    console.log(`Found ${contacts.length} contacts without embeddings`);

    let successCount = 0;
    for (const contact of contacts) {
      try {
        // Combine name, email, and key properties for embedding
        const props = contact.properties || {};
        const textToEmbed = `
          Name: ${contact.name || ""}
          Email: ${contact.email || ""}
          Phone: ${props.phone || ""}
          Company: ${props.company || ""}
          Job Title: ${props.jobtitle || ""}
          Location: ${[props.city, props.state, props.country]
            .filter(Boolean)
            .join(", ")}
        `.trim();

        const embedding = await generateEmbedding(textToEmbed);

        if (embedding) {
          await query(
            "UPDATE contacts SET embedding = $1::vector WHERE id = $2",
            [arrayToVector(embedding), contact.id]
          );
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing contact ${contact.id}:`, error.message);
      }
    }

    console.log(`✅ Generated embeddings for ${successCount} contacts`);
    return successCount;
  } catch (error) {
    console.error("Error generating contact embeddings:", error);
    throw error;
  }
};

/**
 * Generate embeddings for all notes without embeddings
 */
export const generateNoteEmbeddings = async (userId = null) => {
  try {
    console.log("Generating embeddings for notes...");

    const whereClause = userId
      ? { userId, embedding: null }
      : { embedding: null };
    const notes = await Note.findAll({
      where: whereClause,
      limit: 100,
    });

    console.log(`Found ${notes.length} notes without embeddings`);

    let successCount = 0;
    for (const note of notes) {
      try {
        const embedding = await generateEmbedding(note.body || "");

        if (embedding) {
          await query("UPDATE notes SET embedding = $1::vector WHERE id = $2", [
            arrayToVector(embedding),
            note.id,
          ]);
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing note ${note.id}:`, error.message);
      }
    }

    console.log(`✅ Generated embeddings for ${successCount} notes`);
    return successCount;
  } catch (error) {
    console.error("Error generating note embeddings:", error);
    throw error;
  }
};

/**
 * Generate all embeddings for a user
 */
export const generateAllEmbeddings = async (userId = null) => {
  const results = {
    emails: 0,
    contacts: 0,
    notes: 0,
  };

  try {
    results.emails = await generateEmailEmbeddings(userId);
    results.contacts = await generateContactEmbeddings(userId);
    results.notes = await generateNoteEmbeddings(userId);

    console.log("✅ All embeddings generated:", results);
    return results;
  } catch (error) {
    console.error("Error generating all embeddings:", error);
    throw error;
  }
};

export default {
  generateEmbedding,
  generateEmailEmbeddings,
  generateContactEmbeddings,
  generateNoteEmbeddings,
  generateAllEmbeddings,
};
