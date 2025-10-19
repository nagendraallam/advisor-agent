/**
 * Tool definitions that the LLM can use
 * Each tool describes what it does and what parameters it needs
 */

export const toolDefinitions = [
  {
    name: "search_emails",
    description:
      "Search for emails by sender name, email address, subject keywords, or body content. Returns matching emails with their details.",
    parameters: {
      query: {
        type: "string",
        description:
          "Search query - can be sender name, email address, subject keywords, or body content",
        required: true,
      },
      limit: {
        type: "number",
        description: "Maximum number of emails to return (default: 5)",
        required: false,
      },
    },
  },
  {
    name: "read_email",
    description:
      "Read the full content of a specific email by its ID. Returns the complete email with subject, sender, date, and full body.",
    parameters: {
      email_id: {
        type: "number",
        description: "The database ID of the email to read",
        required: true,
      },
    },
  },
  {
    name: "send_email",
    description:
      "Send an email to a recipient via Gmail. Requires recipient email, subject, and body content.",
    parameters: {
      to_email: {
        type: "string",
        description: "Recipient's email address",
        required: true,
      },
      to_name: {
        type: "string",
        description: "Recipient's name (optional)",
        required: false,
      },
      subject: {
        type: "string",
        description: "Email subject line",
        required: true,
      },
      body: {
        type: "string",
        description: "Email body content",
        required: true,
      },
    },
  },
  {
    name: "search_hubspot_contacts",
    description:
      "Search for contacts in HubSpot CRM by name, email, company, or other properties. Returns matching contacts with their details.",
    parameters: {
      query: {
        type: "string",
        description:
          "Search query - can be name, email, company, or other contact properties",
        required: true,
      },
      limit: {
        type: "number",
        description: "Maximum number of contacts to return (default: 5)",
        required: false,
      },
    },
  },
  {
    name: "create_hubspot_contact",
    description:
      "Create a new contact in HubSpot CRM with provided details. Requires at least email or name.",
    parameters: {
      email: {
        type: "string",
        description: "Contact's email address",
        required: false,
      },
      firstname: {
        type: "string",
        description: "Contact's first name",
        required: false,
      },
      lastname: {
        type: "string",
        description: "Contact's last name",
        required: false,
      },
      company: {
        type: "string",
        description: "Contact's company name",
        required: false,
      },
      phone: {
        type: "string",
        description: "Contact's phone number",
        required: false,
      },
    },
  },
  {
    name: "semantic_search",
    description:
      "Perform semantic search across emails, contacts, and notes using AI embeddings. Use this for complex queries that require understanding context and meaning.",
    parameters: {
      query: {
        type: "string",
        description: "Natural language query to search for",
        required: true,
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default: 5)",
        required: false,
      },
    },
  },
];

/**
 * Format tool definitions for LLM prompt
 */
export function formatToolsForPrompt() {
  return toolDefinitions
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(([name, config]) => {
          const required = config.required ? "(required)" : "(optional)";
          return `    - ${name} ${required}: ${config.description}`;
        })
        .join("\n");

      return `${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
    })
    .join("\n\n");
}
