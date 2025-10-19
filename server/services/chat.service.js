import OpenAI from "openai";
import { Chat, ChatMessage } from "../models/index.js";
import { Op } from "sequelize";

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

/**
 * Create a new chat for a user
 */
export const createChat = async (userId, initialName = "New Chat") => {
  try {
    const chat = await Chat.create({
      userId,
      name: initialName,
      lastActivity: new Date(),
    });

    console.log(`✅ Created new chat: ${chat.id} for user ${userId}`);
    return chat;
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
};

/**
 * Get all chats for a user (ordered by last activity)
 */
export const getChatsByUser = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0 } = options;

    const chats = await Chat.findAll({
      where: { userId },
      order: [["last_activity", "DESC"]],
      limit,
      offset,
      include: [
        {
          model: ChatMessage,
          as: "messages",
          limit: 1,
          order: [["created_at", "DESC"]],
          attributes: ["content", "role", "created_at"],
        },
      ],
    });

    return chats;
  } catch (error) {
    console.error("Error getting chats:", error);
    throw error;
  }
};

/**
 * Get a specific chat by ID
 */
export const getChat = async (chatId, userId) => {
  try {
    const chat = await Chat.findOne({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    return chat;
  } catch (error) {
    console.error("Error getting chat:", error);
    throw error;
  }
};

/**
 * Get chat with messages
 */
export const getChatWithMessages = async (chatId, userId, options = {}) => {
  try {
    const { limit = 100, offset = 0 } = options;

    const chat = await Chat.findOne({
      where: { id: chatId, userId },
      include: [
        {
          model: ChatMessage,
          as: "messages",
          order: [["created_at", "ASC"]],
          limit,
          offset,
        },
      ],
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    return chat;
  } catch (error) {
    console.error("Error getting chat with messages:", error);
    throw error;
  }
};

/**
 * Update chat activity timestamp
 */
export const updateChatActivity = async (chatId) => {
  try {
    await Chat.update({ lastActivity: new Date() }, { where: { id: chatId } });
  } catch (error) {
    console.error("Error updating chat activity:", error);
    throw error;
  }
};

/**
 * Update chat name
 */
export const updateChatName = async (chatId, userId, name) => {
  try {
    const [updated] = await Chat.update(
      { name },
      { where: { id: chatId, userId } }
    );

    if (updated === 0) {
      throw new Error("Chat not found or not authorized");
    }

    const chat = await getChat(chatId, userId);
    console.log(`✅ Updated chat name: ${chatId} -> "${name}"`);
    return chat;
  } catch (error) {
    console.error("Error updating chat name:", error);
    throw error;
  }
};

/**
 * Generate AI-based chat name from recent messages
 */
export const generateChatName = async (chatId, userId) => {
  try {
    console.log(`🤖 Generating AI name for chat ${chatId}...`);

    // Get recent messages from the chat
    const messages = await ChatMessage.findAll({
      where: { chatId },
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    if (messages.length === 0) {
      return "New Chat";
    }

    // Reverse to chronological order
    messages.reverse();

    // Build context from messages
    const conversationSummary = messages
      .map((msg) => `${msg.role}: ${msg.content.substring(0, 200)}`)
      .join("\n");

    // Ask AI to generate a concise name
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates concise, descriptive chat names.
Based on the conversation provided, generate a short, descriptive name (2-5 words max).
The name should capture the main topic or action discussed.
Use emojis if appropriate (e.g., 📧 for emails, 📅 for meetings, 💼 for business).
Respond with ONLY the chat name, no quotes or extra text.`,
        },
        {
          role: "user",
          content: `Generate a chat name for this conversation:\n\n${conversationSummary}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 20,
    });

    const generatedName =
      response.choices[0].message.content.trim() || "New Chat";

    // Update the chat with the new name
    await updateChatName(chatId, userId, generatedName);

    console.log(`✨ Generated chat name: "${generatedName}"`);
    return generatedName;
  } catch (error) {
    console.error("Error generating chat name:", error);
    return "New Chat";
  }
};

/**
 * Auto-update chat name if still "New Chat" and has enough messages
 */
export const autoUpdateChatName = async (chatId, userId) => {
  try {
    const chat = await getChat(chatId, userId);

    // Only auto-update if it's still "New Chat"
    if (chat.name !== "New Chat") {
      return chat.name;
    }

    // Check if we have at least 2 messages
    const messageCount = await ChatMessage.count({ where: { chatId } });

    if (messageCount >= 2) {
      return await generateChatName(chatId, userId);
    }

    return chat.name;
  } catch (error) {
    console.error("Error auto-updating chat name:", error);
    throw error;
  }
};

/**
 * Delete a chat (and all its messages/tasks via CASCADE)
 */
export const deleteChat = async (chatId, userId) => {
  try {
    const deleted = await Chat.destroy({
      where: { id: chatId, userId },
    });

    if (deleted === 0) {
      throw new Error("Chat not found or not authorized");
    }

    console.log(`🗑️  Deleted chat: ${chatId}`);
    return true;
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
};

/**
 * Get or create default chat for user (for backward compatibility)
 */
export const getOrCreateDefaultChat = async (userId) => {
  try {
    // Try to find an existing chat
    let chat = await Chat.findOne({
      where: { userId },
      order: [["last_activity", "DESC"]],
    });

    // If no chat exists, create one
    if (!chat) {
      chat = await createChat(userId, "Default Chat");
    }

    return chat;
  } catch (error) {
    console.error("Error getting or creating default chat:", error);
    throw error;
  }
};

export default {
  createChat,
  getChatsByUser,
  getChat,
  getChatWithMessages,
  updateChatActivity,
  updateChatName,
  generateChatName,
  autoUpdateChatName,
  deleteChat,
  getOrCreateDefaultChat,
};
