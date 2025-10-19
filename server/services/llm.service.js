import OpenAI from "openai";
import { openAITools } from "./tools/openaiToolDefinitions.js";
import { executeTools } from "./tools/toolExecutor.js";

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

const LLM_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Build system prompt for the AI assistant
 */
export const buildSystemPrompt = () => {
  return `You are a helpful AI assistant that helps users manage their emails, contacts, and business communications.

You have access to various tools that allow you to:
- Search and read emails
- Send emails via Gmail
- Search for contacts in HubSpot CRM
- Create new contacts in HubSpot
- Perform semantic searches across all data

When a user asks you to do something:
1. Analyze their request carefully
2. Use the appropriate tools to gather information or perform actions
3. Provide clear, helpful responses based on the tool results
4. Be proactive - if you need to use multiple tools to complete a task, do so
5. Always confirm actions that were taken (e.g., "I've sent the email to...")

Guidelines:
- Be concise but informative
- Reference specific details from emails/contacts when relevant
- If you can't find something, say so clearly
- When sending emails, expand on the user's brief instructions to create a professional message
- Always verify you have the correct contact information before sending emails`;
};

/**
 * Generate response with OpenAI function calling
 */
export const generateResponseWithTools = async (
  userQuery,
  context,
  toolContext,
  conversationHistory = []
) => {
  try {
    console.log("\n🤖 Starting OpenAI function calling generation...");
    console.log(`📝 User Query: "${userQuery}"`);

    // Build messages array
    const messages = [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      // Add conversation history if any
      ...conversationHistory,
      {
        role: "user",
        content: `${userQuery}\n\nContext from previous search:\n${context}`,
      },
    ];

    // Initial API call with tools
    let response = await getOpenAIClient().chat.completions.create({
      model: LLM_MODEL,
      messages: messages,
      tools: openAITools,
      tool_choice: "auto", // Let the model decide if tools are needed
      temperature: 0.7,
    });

    let assistantMessage = response.choices[0].message;
    let toolResults = [];
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    // Handle function calling loop
    while (assistantMessage.tool_calls && iterations < maxIterations) {
      iterations++;
      console.log(
        `\n🔧 Iteration ${iterations}: Model requested ${assistantMessage.tool_calls.length} tool call(s)`
      );

      // Add assistant's message with tool calls to conversation
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`\n🛠️  Calling: ${functionName}`);
        console.log(`📋 Arguments:`, functionArgs);

        // Execute the tool
        const { executeTool } = await import("./tools/toolExecutor.js");
        const result = await executeTool(
          functionName,
          functionArgs,
          toolContext
        );

        console.log(`✅ Result:`, result);

        // Store for response
        toolResults.push({
          tool: functionName,
          result: result,
        });

        // Add tool result to conversation
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(result),
        });
      }

      // Get next response from model with tool results
      response = await getOpenAIClient().chat.completions.create({
        model: LLM_MODEL,
        messages: messages,
        tools: openAITools,
        tool_choice: "auto",
        temperature: 0.7,
      });

      assistantMessage = response.choices[0].message;
    }

    // Extract final response
    const finalResponse =
      assistantMessage.content || "I've completed the requested action.";

    console.log(
      `\n✅ Final response generated (used ${toolResults.length} tool(s))`
    );
    console.log(`📤 Response: ${finalResponse.substring(0, 100)}...`);

    return {
      response: finalResponse,
      toolsUsed: toolResults,
    };
  } catch (error) {
    console.error("Error in OpenAI function calling:", error);
    throw error;
  }
};

/**
 * Generate a simple response without tools (legacy support)
 */
export const generateResponse = async (prompt, options = {}) => {
  try {
    const { temperature = 0.7 } = options;

    const response = await getOpenAIClient().chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: temperature,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response:", error);
    throw error;
  }
};

/**
 * Generate RAG response (legacy - without tools)
 */
export const generateRAGResponse = async (userQuery, context) => {
  const prompt = `Based on the context below, answer the user's question.

Context:
${context}

User Question: ${userQuery}

Answer:`;

  return await generateResponse(prompt);
};

export default {
  generateResponse,
  generateRAGResponse,
  generateResponseWithTools,
  buildSystemPrompt,
};
