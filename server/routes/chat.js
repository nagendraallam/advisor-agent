import express from "express";
import {
  semanticSearch,
  formatContextForLLM,
} from "../services/rag.service.js";
import { generateResponseWithTools } from "../services/llm.service.js";
import ChatMessage from "../models/ChatMessage.js";
import {
  createChat,
  getChatsByUser,
  getChat,
  updateChatActivity,
  updateChatName,
  generateChatName,
  autoUpdateChatName,
  deleteChat,
  getOrCreateDefaultChat,
} from "../services/chat.service.js";
import {
  getTasksByChatId,
  getActiveTasksByUser,
  cancelTask,
} from "../services/task.service.js";

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.user) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
};

// ===== CHAT MANAGEMENT ENDPOINTS =====

/**
 * GET /api/chat/list - Get all chats for user
 */
router.get("/list", isAuthenticated, async (req, res) => {
  try {
    const chats = await getChatsByUser(req.user.id);

    // Get task counts for each chat
    const chatsWithTasks = await Promise.all(
      chats.map(async (chat) => {
        const tasks = await getTasksByChatId(chat.id);
        const activeTasks = tasks.filter((t) => t.status === "waiting").length;

        return {
          id: chat.id,
          name: chat.name,
          lastActivity: chat.lastActivity,
          createdAt: chat.createdAt,
          activeTasks,
        };
      })
    );

    res.json({ chats: chatsWithTasks });
  } catch (error) {
    console.error("Error getting chat list:", error);
    res.status(500).json({ error: "Failed to get chats" });
  }
});

/**
 * POST /api/chat/create - Create new chat
 */
router.post("/create", isAuthenticated, async (req, res) => {
  try {
    const { name } = req.body;
    const chat = await createChat(req.user.id, name || "New Chat");

    res.json({
      success: true,
      chat: {
        id: chat.id,
        name: chat.name,
        createdAt: chat.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

/**
 * GET /api/chat/:chatId - Get specific chat details
 */
router.get("/:chatId", isAuthenticated, async (req, res) => {
  try {
    const chat = await getChat(req.params.chatId, req.user.id);
    const tasks = await getTasksByChatId(req.params.chatId);

    res.json({
      chat: {
        id: chat.id,
        name: chat.name,
        lastActivity: chat.lastActivity,
        createdAt: chat.createdAt,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        description: t.description,
        status: t.status,
        expectedSender: t.expectedSenderEmail,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error getting chat:", error);
    res.status(404).json({ error: "Chat not found" });
  }
});

/**
 * DELETE /api/chat/:chatId - Delete chat
 */
router.delete("/:chatId", isAuthenticated, async (req, res) => {
  try {
    await deleteChat(req.params.chatId, req.user.id);
    res.json({ success: true, message: "Chat deleted" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

/**
 * PUT /api/chat/:chatId/name - Update chat name
 */
router.put("/:chatId/name", isAuthenticated, async (req, res) => {
  try {
    const { name } = req.body;
    const chat = await updateChatName(req.params.chatId, req.user.id, name);

    res.json({
      success: true,
      chat: {
        id: chat.id,
        name: chat.name,
      },
    });
  } catch (error) {
    console.error("Error updating chat name:", error);
    res.status(500).json({ error: "Failed to update chat name" });
  }
});

/**
 * POST /api/chat/:chatId/rename - Auto-generate chat name with AI
 */
router.post("/:chatId/rename", isAuthenticated, async (req, res) => {
  try {
    const newName = await generateChatName(req.params.chatId, req.user.id);

    res.json({
      success: true,
      name: newName,
    });
  } catch (error) {
    console.error("Error generating chat name:", error);
    res.status(500).json({ error: "Failed to generate chat name" });
  }
});

// ===== MESSAGING ENDPOINTS =====

/**
 * POST /api/chat/:chatId/message - Send message in a chat
 */
router.post("/:chatId/message", isAuthenticated, async (req, res) => {
  const { message } = req.body;
  const chatId = parseInt(req.params.chatId);

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Verify chat belongs to user
    await getChat(chatId, req.user.id);

    // Save user message
    await ChatMessage.create({
      chatId,
      userId: req.user.id,
      role: "user",
      content: message,
    });

    // Update chat activity
    await updateChatActivity(chatId);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎯 Processing query in chat ${chatId}: "${message}"`);
    console.log(`${"=".repeat(60)}\n`);

    // Step 1: Perform initial semantic search for context
    const searchResults = await semanticSearch(req.user.id, message, {
      topK: 5,
      minSimilarity: 0.3,
    });
    const context = formatContextForLLM(searchResults);

    // Step 2: Generate response with tool calling support
    const toolContext = {
      user: req.user,
      userId: req.user.id,
      chatId, // Important: pass chatId for task creation
    };

    const llmResult = await generateResponseWithTools(
      message,
      context,
      toolContext
    );

    const aiResponse = llmResult.response;
    const toolsUsed = llmResult.toolsUsed || [];

    console.log(`\n✅ Response generated (used ${toolsUsed.length} tool(s))`);

    // Step 3: Save assistant message with context and tool usage
    await ChatMessage.create({
      chatId,
      userId: req.user.id,
      role: "assistant",
      content: aiResponse,
      context: {
        searchResults: searchResults.map((r) => ({
          type: r.type,
          id: r.id,
          similarity: r.similarity,
        })),
        resultsCount: searchResults.length,
        toolsUsed: toolsUsed.map((t) => ({
          tool: t.tool,
          success: t.result?.success || false,
        })),
      },
    });

    // Step 4: Auto-update chat name if still "New Chat"
    await autoUpdateChatName(chatId, req.user.id);

    // Step 5: Prepare response with sources and tool info
    const sources = searchResults.map((r) => ({
      type: r.type,
      snippet:
        r.type === "email"
          ? r.subject
          : r.type === "contact"
          ? r.name
          : r.body?.substring(0, 100),
      similarity: r.similarity,
    }));

    // Add tool results as sources
    toolsUsed.forEach((toolResult) => {
      if (toolResult.result?.success) {
        sources.push({
          type: "tool",
          snippet: `Used: ${toolResult.tool}`,
          similarity: 1.0,
        });
      }
    });

    const response = {
      message: aiResponse,
      timestamp: new Date().toISOString(),
      type: "assistant",
      sources: sources,
      toolsUsed: toolsUsed.length,
    };

    res.json(response);
  } catch (error) {
    console.error("Chat message error:", error);

    res.status(500).json({
      error: "Failed to process message",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/:chatId/messages - Get messages for a chat
 */
router.get("/:chatId/messages", isAuthenticated, async (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);

    // Verify chat belongs to user
    await getChat(chatId, req.user.id);

    const messages = await ChatMessage.findAll({
      where: { chatId },
      order: [["created_at", "ASC"]],
      limit: 100,
    });

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        context: msg.context,
      })),
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// ===== TASK ENDPOINTS =====

/**
 * GET /api/chat/:chatId/tasks - Get tasks for a chat
 */
router.get("/:chatId/tasks", isAuthenticated, async (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);

    // Verify chat belongs to user
    await getChat(chatId, req.user.id);

    const tasks = await getTasksByChatId(chatId);

    res.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        description: t.description,
        status: t.status,
        taskType: t.taskType,
        expectedSender: t.expectedSenderEmail,
        expectedSenderName: t.expectedSenderName,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ error: "Failed to get tasks" });
  }
});

/**
 * GET /api/chat/tasks/active - Get all active tasks for user
 */
router.get("/tasks/active", isAuthenticated, async (req, res) => {
  try {
    const tasks = await getActiveTasksByUser(req.user.id);

    res.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        chatId: t.chatId,
        description: t.description,
        status: t.status,
        expectedSender: t.expectedSenderEmail,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get active tasks error:", error);
    res.status(500).json({ error: "Failed to get active tasks" });
  }
});

/**
 * POST /api/chat/tasks/:taskId/cancel - Cancel a task
 */
router.post("/tasks/:taskId/cancel", isAuthenticated, async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const task = await cancelTask(taskId, req.user.id);

    res.json({
      success: true,
      task: {
        id: task.id,
        status: task.status,
      },
    });
  } catch (error) {
    console.error("Cancel task error:", error);
    res.status(500).json({ error: "Failed to cancel task" });
  }
});

// ===== LEGACY/COMPATIBILITY ENDPOINTS =====

/**
 * POST /api/chat/message - Send message (creates default chat if needed)
 * For backward compatibility with existing frontend
 */
router.post("/message", isAuthenticated, async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // Get or create default chat
    const chat = await getOrCreateDefaultChat(req.user.id);
    const chatId = chat.id;

    // Save user message
    await ChatMessage.create({
      chatId,
      userId: req.user.id,
      role: "user",
      content: message,
    });

    // Update chat activity
    await updateChatActivity(chatId);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎯 Processing query in chat ${chatId}: "${message}"`);
    console.log(`${"=".repeat(60)}\n`);

    // Step 1: Perform initial semantic search for context
    const searchResults = await semanticSearch(req.user.id, message, {
      topK: 5,
      minSimilarity: 0.3,
    });
    const context = formatContextForLLM(searchResults);

    // Step 2: Generate response with tool calling support
    const toolContext = {
      user: req.user,
      userId: req.user.id,
      chatId,
    };

    const llmResult = await generateResponseWithTools(
      message,
      context,
      toolContext
    );

    const aiResponse = llmResult.response;
    const toolsUsed = llmResult.toolsUsed || [];

    console.log(`\n✅ Response generated (used ${toolsUsed.length} tool(s))`);

    // Step 3: Save assistant message with context and tool usage
    await ChatMessage.create({
      chatId,
      userId: req.user.id,
      role: "assistant",
      content: aiResponse,
      context: {
        searchResults: searchResults.map((r) => ({
          type: r.type,
          id: r.id,
          similarity: r.similarity,
        })),
        resultsCount: searchResults.length,
        toolsUsed: toolsUsed.map((t) => ({
          tool: t.tool,
          success: t.result?.success || false,
        })),
      },
    });

    // Step 4: Auto-update chat name if still "New Chat"
    await autoUpdateChatName(chatId, req.user.id);

    // Step 5: Prepare response with sources and tool info
    const sources = searchResults.map((r) => ({
      type: r.type,
      snippet:
        r.type === "email"
          ? r.subject
          : r.type === "contact"
          ? r.name
          : r.body?.substring(0, 100),
      similarity: r.similarity,
    }));

    // Add tool results as sources
    toolsUsed.forEach((toolResult) => {
      if (toolResult.result?.success) {
        sources.push({
          type: "tool",
          snippet: `Used: ${toolResult.tool}`,
          similarity: 1.0,
        });
      }
    });

    const response = {
      message: aiResponse,
      timestamp: new Date().toISOString(),
      type: "assistant",
      sources: sources,
      toolsUsed: toolsUsed.length,
      chatId: chatId,
    };

    res.json(response);
  } catch (error) {
    console.error("Chat message error:", error);
    res.status(500).json({
      error: "Failed to process message",
      message: error.message,
    });
  }
});

/**
 * GET /api/chat/history - Get history (from default chat)
 * For backward compatibility
 */
router.get("/history", isAuthenticated, async (req, res) => {
  try {
    const chat = await getOrCreateDefaultChat(req.user.id);

    const messages = await ChatMessage.findAll({
      where: { chatId: chat.id },
      order: [["created_at", "ASC"]],
      limit: 100,
    });

    res.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        context: msg.context,
      })),
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: "Failed to get chat history" });
  }
});

export default router;
