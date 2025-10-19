import { searchEmails, readEmail, sendEmail } from "./emailTools.js";
import {
  searchHubSpotContacts,
  createHubSpotContact,
  getHubSpotContact,
} from "./hubspotTools.js";
import { semanticSearch } from "../rag.service.js";
import {
  createOngoingTask,
  listOngoingTasks,
  cancelOngoingTask,
} from "./taskTools.js";

/**
 * Execute a tool based on its name and parameters
 */
export async function executeTool(toolName, parameters, context) {
  const { user, userId } = context;

  console.log(`\n🔧 Executing tool: ${toolName}`);
  console.log(`📋 Parameters:`, JSON.stringify(parameters, null, 2));

  try {
    let result;

    switch (toolName) {
      case "search_emails":
        result = await searchEmails({ ...parameters, userId });
        break;

      case "read_email":
        result = await readEmail({ ...parameters, userId });
        break;

      case "send_email":
        result = await sendEmail({ ...parameters, user });
        break;

      case "search_hubspot_contacts":
        result = await searchHubSpotContacts({ ...parameters, userId });
        break;

      case "create_hubspot_contact":
        result = await createHubSpotContact({ ...parameters, user });
        break;

      case "get_hubspot_contact":
        result = await getHubSpotContact({ ...parameters, userId });
        break;

      case "semantic_search":
        const searchResults = await semanticSearch(userId, parameters.query, {
          topK: parameters.limit || 5,
        });
        result = {
          success: true,
          results: searchResults,
          count: searchResults.length,
        };
        break;

      case "create_ongoing_task":
        result = await createOngoingTask({
          ...parameters,
          chatId: context.chatId,
          userId,
        });
        break;

      case "list_ongoing_tasks":
        result = await listOngoingTasks({
          ...parameters,
          chatId: context.chatId,
          userId,
        });
        break;

      case "cancel_task":
        result = await cancelOngoingTask({ ...parameters, userId });
        break;

      default:
        result = {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }

    console.log(`✅ Tool execution completed: ${toolName}`);
    return result;
  } catch (error) {
    console.error(`❌ Tool execution failed: ${toolName}`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute multiple tools in sequence
 */
export async function executeTools(toolCalls, context) {
  const results = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(
      toolCall.tool,
      toolCall.parameters,
      context
    );
    results.push({
      tool: toolCall.tool,
      result: result,
    });
  }

  return results;
}

/**
 * Parse tool calls from LLM response
 * Expected format: TOOL_CALL: tool_name(param1="value1", param2="value2")
 */
export function parseToolCallsFromResponse(llmResponse) {
  const toolCalls = [];
  const toolCallRegex = /TOOL_CALL:\s*(\w+)\((.*?)\)/g;

  let match;
  while ((match = toolCallRegex.exec(llmResponse)) !== null) {
    const toolName = match[1];
    const paramsString = match[2];

    // Parse parameters
    const parameters = {};
    const paramRegex = /(\w+)=["']([^"']*)["']/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsString)) !== null) {
      parameters[paramMatch[1]] = paramMatch[2];
    }

    toolCalls.push({
      tool: toolName,
      parameters: parameters,
    });
  }

  return toolCalls;
}

/**
 * Format tool results for LLM
 */
export function formatToolResultsForLLM(toolResults) {
  if (!toolResults || toolResults.length === 0) {
    return "No tool results available.";
  }

  return toolResults
    .map((tr, index) => {
      const resultStr = JSON.stringify(tr.result, null, 2);
      return `Tool ${index + 1}: ${tr.tool}\nResult:\n${resultStr}`;
    })
    .join("\n\n");
}
