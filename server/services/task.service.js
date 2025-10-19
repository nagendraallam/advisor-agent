import { OngoingTask, Email, ChatMessage } from "../models/index.js";
import { Op } from "sequelize";
import { generateResponse } from "./llm.service.js";

/**
 * Create a new ongoing task
 */
export const createTask = async (taskDetails) => {
  try {
    const {
      chatId,
      userId,
      taskType = "email_response",
      description,
      expectedSenderEmail,
      expectedSenderName,
      relatedEmailId,
      context = {},
    } = taskDetails;

    const task = await OngoingTask.create({
      chatId,
      userId,
      taskType,
      status: "waiting",
      description,
      expectedSenderEmail: expectedSenderEmail?.toLowerCase(),
      expectedSenderName,
      relatedEmailId,
      context,
    });

    console.log(
      `✅ Created task: ${task.id} - Waiting for ${
        expectedSenderEmail || "response"
      }`
    );
    return task;
  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
};

/**
 * Get all tasks for a specific chat
 */
export const getTasksByChatId = async (chatId) => {
  try {
    const tasks = await OngoingTask.findAll({
      where: { chatId },
      order: [["created_at", "DESC"]],
    });

    return tasks;
  } catch (error) {
    console.error("Error getting tasks by chat:", error);
    throw error;
  }
};

/**
 * Get all active (waiting) tasks for a user
 */
export const getActiveTasksByUser = async (userId) => {
  try {
    const tasks = await OngoingTask.findAll({
      where: {
        userId,
        status: "waiting",
      },
      order: [["created_at", "DESC"]],
    });

    return tasks;
  } catch (error) {
    console.error("Error getting active tasks:", error);
    throw error;
  }
};

/**
 * Get a specific task by ID
 */
export const getTask = async (taskId, userId) => {
  try {
    const task = await OngoingTask.findOne({
      where: { id: taskId, userId },
    });

    return task;
  } catch (error) {
    console.error("Error getting task:", error);
    throw error;
  }
};

/**
 * Match incoming email to ongoing tasks
 * Returns array of matched tasks
 */
export const matchEmailToTasks = async (email, userId) => {
  try {
    const senderEmail = email.from_email?.toLowerCase();

    if (!senderEmail) {
      return [];
    }

    console.log(`🔍 Checking for tasks waiting for: ${senderEmail}`);

    // Find all active tasks waiting for this sender
    const matchedTasks = await OngoingTask.findAll({
      where: {
        userId,
        status: "waiting",
        expectedSenderEmail: senderEmail,
      },
    });

    if (matchedTasks.length > 0) {
      console.log(`✅ Found ${matchedTasks.length} matching task(s)!`);
    }

    return matchedTasks;
  } catch (error) {
    console.error("Error matching email to tasks:", error);
    throw error;
  }
};

/**
 * Complete a task and update its status
 */
export const completeTask = async (taskId, emailId = null) => {
  try {
    const task = await OngoingTask.findByPk(taskId);

    if (!task) {
      throw new Error("Task not found");
    }

    task.status = "completed";
    task.completedAt = new Date();

    if (emailId) {
      task.relatedEmailId = emailId;
    }

    await task.save();

    console.log(`✅ Task ${taskId} marked as completed`);
    return task;
  } catch (error) {
    console.error("Error completing task:", error);
    throw error;
  }
};

/**
 * Cancel a task
 */
export const cancelTask = async (taskId, userId) => {
  try {
    const task = await OngoingTask.findOne({
      where: { id: taskId, userId },
    });

    if (!task) {
      throw new Error("Task not found or not authorized");
    }

    task.status = "cancelled";
    await task.save();

    console.log(`🚫 Task ${taskId} cancelled`);
    return task;
  } catch (error) {
    console.error("Error cancelling task:", error);
    throw error;
  }
};

/**
 * Generate AI summary of email for task notification
 */
export const generateEmailSummary = async (email) => {
  try {
    const emailContext = `
From: ${email.from_name || email.from_email}
Subject: ${email.subject}
Date: ${email.date}

Body:
${email.body_text || email.body_html?.substring(0, 1000) || "No content"}
    `.trim();

    const prompt = `Summarize this email response in 2-3 sentences. Focus on key points and action items.

${emailContext}

Summary:`;

    const summary = await generateResponse(prompt, { temperature: 0.5 });
    return summary.trim();
  } catch (error) {
    console.error("Error generating email summary:", error);
    return `${email.from_name || email.from_email} responded: ${email.subject}`;
  }
};

/**
 * Post task completion notification to chat
 */
export const postTaskCompletionToChat = async (task, email) => {
  try {
    console.log(`📬 Posting task completion to chat ${task.chatId}`);

    // Generate AI summary of the email
    const emailSummary = await generateEmailSummary(email);

    const notificationContent = `📬 **Task Update: Response Received**

${
  task.expectedSenderName || task.expectedSenderEmail
} has responded to your email!

**Subject:** ${email.subject}

**Summary:**
${emailSummary}

**From:** ${email.from_name || email.from_email}
**Date:** ${new Date(email.date).toLocaleString()}

You can ask me to read the full email or take further actions.`;

    // Create a system message in the chat
    const message = await ChatMessage.create({
      chatId: task.chatId,
      userId: task.userId,
      role: "assistant",
      content: notificationContent,
      context: {
        type: "task_completion",
        taskId: task.id,
        emailId: email.id,
        automated: true,
      },
    });

    console.log(`✅ Posted notification message to chat ${task.chatId}`);
    return message;
  } catch (error) {
    console.error("Error posting task completion:", error);
    throw error;
  }
};

/**
 * Get task statistics for a user
 */
export const getTaskStatistics = async (userId) => {
  try {
    const [waiting, completed, cancelled] = await Promise.all([
      OngoingTask.count({ where: { userId, status: "waiting" } }),
      OngoingTask.count({ where: { userId, status: "completed" } }),
      OngoingTask.count({ where: { userId, status: "cancelled" } }),
    ]);

    return {
      waiting,
      completed,
      cancelled,
      total: waiting + completed + cancelled,
    };
  } catch (error) {
    console.error("Error getting task statistics:", error);
    throw error;
  }
};

export default {
  createTask,
  getTasksByChatId,
  getActiveTasksByUser,
  getTask,
  matchEmailToTasks,
  completeTask,
  cancelTask,
  generateEmailSummary,
  postTaskCompletionToChat,
  getTaskStatistics,
};
