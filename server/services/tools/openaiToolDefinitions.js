/**
 * Tool definitions in OpenAI function calling format
 * These are used by OpenAI's GPT models to understand what tools are available
 */

export const openAITools = [
  {
    type: "function",
    function: {
      name: "search_emails",
      description:
        "Search for emails by sender name, email address, subject keywords, or body content. Returns matching emails with their details.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query - can be sender name, email address, subject keywords, or body content",
          },
          limit: {
            type: "number",
            description: "Maximum number of emails to return",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_email",
      description:
        "Read the full content of a specific email by its ID. Returns the complete email with subject, sender, date, and full body.",
      parameters: {
        type: "object",
        properties: {
          email_id: {
            type: "number",
            description: "The database ID of the email to read",
          },
        },
        required: ["email_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Send an email to a recipient via Gmail. Requires recipient email, subject, and body content.",
      parameters: {
        type: "object",
        properties: {
          to_email: {
            type: "string",
            description: "Recipient's email address",
          },
          to_name: {
            type: "string",
            description: "Recipient's name (optional)",
          },
          subject: {
            type: "string",
            description: "Email subject line",
          },
          body: {
            type: "string",
            description: "Email body content",
          },
        },
        required: ["to_email", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_hubspot_contacts",
      description:
        "Search for contacts in HubSpot CRM by name, email, company, or other properties. Returns matching contacts with their details.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query - can be name, email, company, or other contact properties",
          },
          limit: {
            type: "number",
            description: "Maximum number of contacts to return",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_hubspot_contact",
      description:
        "Create a new contact in HubSpot CRM with provided details. Requires at least email or name.",
      parameters: {
        type: "object",
        properties: {
          email: {
            type: "string",
            description: "Contact's email address",
          },
          firstname: {
            type: "string",
            description: "Contact's first name",
          },
          lastname: {
            type: "string",
            description: "Contact's last name",
          },
          company: {
            type: "string",
            description: "Contact's company name",
          },
          phone: {
            type: "string",
            description: "Contact's phone number",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "semantic_search",
      description:
        "Perform semantic search across emails, contacts, and notes using AI embeddings. Use this for complex queries that require understanding context and meaning.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language query to search for",
          },
          limit: {
            type: "number",
            description: "Maximum number of results",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ongoing_task",
      description:
        "Create a task to track and monitor for responses or follow-ups. Use this when you send an email and need to wait for a response, or when any action requires follow-up monitoring.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "Clear description of what this task is waiting for",
          },
          expected_sender_email: {
            type: "string",
            description:
              "Email address of the person we're waiting to hear from",
          },
          expected_sender_name: {
            type: "string",
            description: "Name of the person we're waiting to hear from",
          },
          task_type: {
            type: "string",
            description:
              "Type of task: email_response, meeting_confirmation, etc.",
            default: "email_response",
          },
        },
        required: ["description", "expected_sender_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_ongoing_tasks",
      description:
        "List all ongoing tasks for the current chat or all active tasks for the user. Shows what actions are being monitored and their status.",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            description:
              "Scope: 'chat' for current chat only, 'all' for all user tasks",
            default: "chat",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_task",
      description:
        "Cancel an ongoing task if it's no longer needed or relevant.",
      parameters: {
        type: "object",
        properties: {
          task_id: {
            type: "number",
            description: "ID of the task to cancel",
          },
        },
        required: ["task_id"],
      },
    },
  },
];
