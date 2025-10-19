/**
 * Task management tools for AI agent
 */

import {
  createTask,
  getTasksByChatId,
  getActiveTasksByUser,
  cancelTask,
} from "../task.service.js";

/**
 * Create an ongoing task to monitor for responses/actions
 */
export async function createOngoingTask({
  description,
  expected_sender_email,
  expected_sender_name,
  task_type = "email_response",
  chatId,
  userId,
}) {
  try {
    console.log(`📝 Creating ongoing task: ${description}`);

    const task = await createTask({
      chatId,
      userId,
      taskType: task_type,
      description,
      expectedSenderEmail: expected_sender_email,
      expectedSenderName: expected_sender_name,
      context: {
        created_by: "ai_agent",
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      task: {
        id: task.id,
        description: task.description,
        expectedSender: task.expectedSenderEmail,
        status: task.status,
        createdAt: task.createdAt,
      },
      message: `✅ Task created! I'll monitor for responses from ${
        expected_sender_name || expected_sender_email
      } and notify you when they respond.`,
    };
  } catch (error) {
    console.error("Error creating ongoing task:", error);
    return {
      success: false,
      error: error.message,
      message: "Failed to create task",
    };
  }
}

/**
 * List ongoing tasks
 */
export async function listOngoingTasks({ scope = "chat", chatId, userId }) {
  try {
    console.log(`📋 Listing ongoing tasks (scope: ${scope})`);

    let tasks;
    if (scope === "chat" && chatId) {
      tasks = await getTasksByChatId(chatId);
    } else {
      tasks = await getActiveTasksByUser(userId);
    }

    const taskList = tasks.map((task) => ({
      id: task.id,
      description: task.description,
      expectedSender: task.expectedSenderEmail,
      expectedSenderName: task.expectedSenderName,
      status: task.status,
      taskType: task.taskType,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    }));

    const activeCount = tasks.filter((t) => t.status === "waiting").length;
    const completedCount = tasks.filter((t) => t.status === "completed").length;

    return {
      success: true,
      tasks: taskList,
      summary: {
        total: tasks.length,
        active: activeCount,
        completed: completedCount,
      },
      message:
        activeCount > 0
          ? `You have ${activeCount} active task(s) waiting for responses.`
          : "No active tasks at the moment.",
    };
  } catch (error) {
    console.error("Error listing tasks:", error);
    return {
      success: false,
      error: error.message,
      tasks: [],
    };
  }
}

/**
 * Cancel an ongoing task
 */
export async function cancelOngoingTask({ task_id, userId }) {
  try {
    console.log(`🚫 Cancelling task: ${task_id}`);

    const task = await cancelTask(task_id, userId);

    return {
      success: true,
      task: {
        id: task.id,
        description: task.description,
        status: task.status,
      },
      message: `Task cancelled: ${task.description}`,
    };
  } catch (error) {
    console.error("Error cancelling task:", error);
    return {
      success: false,
      error: error.message,
      message:
        "Failed to cancel task. It may not exist or you may not have permission.",
    };
  }
}

export default {
  createOngoingTask,
  listOngoingTasks,
  cancelOngoingTask,
};
