import { query } from "../config/postgres.js";
import { generateEmbedding } from "./embeddings.service.js";

/**
 * Search emails using vector similarity
 */
export const searchEmails = async (userId, queryEmbedding, limit = 5) => {
  try {
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const result = await query(
      `
      SELECT 
        id,
        message_id,
        subject,
        from_email,
        from_name,
        body_text,
        date,
        labels,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM emails
      WHERE user_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
      [vectorString, userId, limit]
    );

    return result.rows.map((row) => ({
      type: "email",
      id: row.id,
      messageId: row.message_id,
      subject: row.subject,
      fromEmail: row.from_email,
      fromName: row.from_name,
      bodyText: row.body_text,
      date: row.date,
      labels: row.labels,
      metadata: row.metadata,
      similarity: parseFloat(row.similarity),
    }));
  } catch (error) {
    console.error("Error searching emails:", error);
    throw error;
  }
};

/**
 * Search contacts using vector similarity
 */
export const searchContacts = async (userId, queryEmbedding, limit = 5) => {
  try {
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const result = await query(
      `
      SELECT 
        id,
        hubspot_id,
        email,
        name,
        properties,
        1 - (embedding <=> $1::vector) as similarity
      FROM contacts
      WHERE user_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
      `,
      [vectorString, userId, limit]
    );

    return result.rows.map((row) => ({
      type: "contact",
      id: row.id,
      hubspotId: row.hubspot_id,
      email: row.email,
      name: row.name,
      properties: row.properties,
      similarity: parseFloat(row.similarity),
    }));
  } catch (error) {
    console.error("Error searching contacts:", error);
    throw error;
  }
};

/**
 * Search notes using vector similarity
 */
export const searchNotes = async (userId, queryEmbedding, limit = 5) => {
  try {
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const result = await query(
      `
      SELECT 
        n.id,
        n.hubspot_id,
        n.contact_id,
        n.body,
        c.name as contact_name,
        c.email as contact_email,
        1 - (n.embedding <=> $1::vector) as similarity
      FROM notes n
      LEFT JOIN contacts c ON n.contact_id = c.id
      WHERE n.user_id = $2 AND n.embedding IS NOT NULL
      ORDER BY n.embedding <=> $1::vector
      LIMIT $3
      `,
      [vectorString, userId, limit]
    );

    return result.rows.map((row) => ({
      type: "note",
      id: row.id,
      hubspotId: row.hubspot_id,
      contactId: row.contact_id,
      body: row.body,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      similarity: parseFloat(row.similarity),
    }));
  } catch (error) {
    console.error("Error searching notes:", error);
    throw error;
  }
};

/**
 * Perform semantic search across all content types
 */
export const semanticSearch = async (userId, queryText, options = {}) => {
  try {
    const {
      topK = 10,
      minSimilarity = 0.3,
      includeEmails = true,
      includeContacts = true,
      includeNotes = true,
    } = options;

    console.log(`Performing semantic search for: "${queryText}"`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(queryText);

    if (!queryEmbedding) {
      throw new Error("Failed to generate query embedding");
    }

    // Search across all sources in parallel
    const searches = [];

    if (includeEmails) {
      searches.push(searchEmails(userId, queryEmbedding, topK));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (includeContacts) {
      searches.push(searchContacts(userId, queryEmbedding, topK));
    } else {
      searches.push(Promise.resolve([]));
    }

    if (includeNotes) {
      searches.push(searchNotes(userId, queryEmbedding, topK));
    } else {
      searches.push(Promise.resolve([]));
    }

    const [emails, contacts, notes] = await Promise.all(searches);

    // Combine and sort by similarity
    const allResults = [...emails, ...contacts, ...notes]
      .filter((result) => result.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    console.log(`Found ${allResults.length} relevant results`);

    return allResults;
  } catch (error) {
    console.error("Error in semantic search:", error);
    throw error;
  }
};

/**
 * Format search results as context for LLM
 */
export const formatContextForLLM = (searchResults) => {
  if (!searchResults || searchResults.length === 0) {
    return "No relevant information found.";
  }

  let context = "Here is relevant information from your data:\n\n";

  searchResults.forEach((result, index) => {
    context += `[${index + 1}] `;

    if (result.type === "email") {
      context += `Email from ${result.fromName || result.fromEmail} (${new Date(
        result.date
      ).toLocaleDateString()}):\n`;
      context += `Subject: ${result.subject}\n`;
      context += `Content: ${result.bodyText.substring(0, 500)}...\n`;
    } else if (result.type === "contact") {
      context += `Contact: ${result.name}\n`;
      context += `Email: ${result.email || "N/A"}\n`;
      if (result.properties) {
        if (result.properties.company) {
          context += `Company: ${result.properties.company}\n`;
        }
        if (result.properties.jobtitle) {
          context += `Job Title: ${result.properties.jobtitle}\n`;
        }
      }
    } else if (result.type === "note") {
      context += `Note about ${result.contactName || "contact"}:\n`;
      context += `${result.body.substring(0, 500)}...\n`;
    }

    context += `(Relevance: ${(result.similarity * 100).toFixed(1)}%)\n\n`;
  });

  return context;
};

/**
 * Deduplicate results by content similarity
 */
export const deduplicateResults = (results) => {
  // Simple deduplication based on exact IDs
  const seen = new Set();
  return results.filter((result) => {
    const key = `${result.type}-${result.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export default {
  searchEmails,
  searchContacts,
  searchNotes,
  semanticSearch,
  formatContextForLLM,
  deduplicateResults,
};
