import { Client } from "@hubspot/api-client";
import { Op } from "sequelize";
import Contact from "../../models/Contact.js";

/**
 * Initialize HubSpot client with user's access token
 */
const getHubSpotClient = (accessToken) => {
  return new Client({ accessToken });
};

/**
 * Search for contacts in HubSpot/local database
 */
export async function searchHubSpotContacts({
  query: searchQuery,
  limit = 5,
  userId,
}) {
  try {
    console.log(`Searching HubSpot contacts for: "${searchQuery}"`);

    // Search in local database first
    const contacts = await Contact.findAll({
      where: {
        userId: userId,
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchQuery}%` } },
          { email: { [Op.iLike]: `%${searchQuery}%` } },
        ],
      },
      limit: limit,
      attributes: ["id", "hubspotId", "name", "email", "properties"],
    });

    const results = contacts.map((contact) => ({
      id: contact.id,
      hubspotId: contact.hubspotId,
      name: contact.name,
      email: contact.email,
      company: contact.properties?.company || null,
      phone: contact.properties?.phone || null,
      jobtitle: contact.properties?.jobtitle || null,
    }));

    console.log(`Found ${results.length} contacts`);
    return {
      success: true,
      results: results,
      count: results.length,
    };
  } catch (error) {
    console.error("Error searching contacts:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a new contact in HubSpot
 */
export async function createHubSpotContact({
  email,
  firstname,
  lastname,
  company,
  phone,
  user,
}) {
  try {
    console.log(`Creating HubSpot contact: ${email || firstname}`);

    if (!user.hubspotAccessToken) {
      return {
        success: false,
        error: "No HubSpot access token available",
      };
    }

    const hubspotClient = getHubSpotClient(user.hubspotAccessToken);

    // Prepare contact properties
    const properties = {};
    if (email) properties.email = email;
    if (firstname) properties.firstname = firstname;
    if (lastname) properties.lastname = lastname;
    if (company) properties.company = company;
    if (phone) properties.phone = phone;

    // Create contact in HubSpot
    const response = await hubspotClient.crm.contacts.basicApi.create({
      properties: properties,
    });

    console.log(`Contact created in HubSpot, ID: ${response.id}`);

    // Store in local database
    const name = [firstname, lastname].filter(Boolean).join(" ") || "Unknown";
    const localContact = await Contact.create({
      userId: user.id,
      hubspotId: response.id,
      email: email,
      name: name,
      properties: properties,
    });

    return {
      success: true,
      hubspotId: response.id,
      localId: localContact.id,
      message: `Contact created successfully: ${name}`,
      contact: {
        id: localContact.id,
        hubspotId: response.id,
        name: name,
        email: email,
        company: company,
        phone: phone,
      },
    };
  } catch (error) {
    console.error("Error creating contact:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get contact details by ID
 */
export async function getHubSpotContact({ contact_id, userId }) {
  try {
    const contact = await Contact.findOne({
      where: {
        id: contact_id,
        userId: userId,
      },
    });

    if (!contact) {
      return {
        success: false,
        error: "Contact not found",
      };
    }

    return {
      success: true,
      contact: {
        id: contact.id,
        hubspotId: contact.hubspotId,
        name: contact.name,
        email: contact.email,
        properties: contact.properties,
      },
    };
  } catch (error) {
    console.error("Error getting contact:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
