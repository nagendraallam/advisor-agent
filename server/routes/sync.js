import express from "express";
import { syncGmailForUser } from "../services/gmail.service.js";
import { syncHubSpotForUser } from "../services/hubspot.service.js";
import SyncStatus from "../models/SyncStatus.js";

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.user) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
};

/**
 * Sync Gmail emails
 */
router.post("/gmail", isAuthenticated, async (req, res) => {
  try {
    if (!req.user.googleAccessToken) {
      return res.status(400).json({ error: "Google account not connected" });
    }

    const result = await syncGmailForUser(req.user);

    res.json({
      success: true,
      message: `Synced ${result.count} emails`,
      count: result.count,
    });
  } catch (error) {
    console.error("Gmail sync error:", error);
    res.status(500).json({
      error: "Failed to sync Gmail",
      message: error.message,
    });
  }
});

/**
 * Sync HubSpot contacts and notes
 */
router.post("/hubspot", isAuthenticated, async (req, res) => {
  try {
    if (!req.user.hubspotAccessToken) {
      return res.status(400).json({ error: "HubSpot account not connected" });
    }

    const result = await syncHubSpotForUser(req.user);

    res.json({
      success: true,
      message: `Synced ${result.contactCount} contacts and ${result.noteCount} notes`,
      contactCount: result.contactCount,
      noteCount: result.noteCount,
    });
  } catch (error) {
    console.error("HubSpot sync error:", error);
    res.status(500).json({
      error: "Failed to sync HubSpot",
      message: error.message,
    });
  }
});

/**
 * Sync all sources (Gmail + HubSpot)
 */
router.post("/all", isAuthenticated, async (req, res) => {
  const results = {
    gmail: null,
    hubspot: null,
    errors: [],
  };

  try {
    // Sync Gmail if connected
    if (req.user.googleAccessToken) {
      try {
        results.gmail = await syncGmailForUser(req.user);
      } catch (error) {
        console.error("Gmail sync error:", error);
        results.errors.push({ source: "gmail", message: error.message });
      }
    }

    // Sync HubSpot if connected
    if (req.user.hubspotAccessToken) {
      try {
        results.hubspot = await syncHubSpotForUser(req.user);
      } catch (error) {
        console.error("HubSpot sync error:", error);
        results.errors.push({ source: "hubspot", message: error.message });
      }
    }

    res.json({
      success: results.errors.length === 0,
      results,
    });
  } catch (error) {
    console.error("Sync all error:", error);
    res.status(500).json({
      error: "Failed to sync data",
      message: error.message,
    });
  }
});

/**
 * Get sync status for all sources
 */
router.get("/status", isAuthenticated, async (req, res) => {
  try {
    const syncStatuses = await SyncStatus.findAll({
      where: { userId: req.user.id },
    });

    const statusMap = {};
    syncStatuses.forEach((status) => {
      statusMap[status.source] = {
        lastSyncAt: status.lastSyncAt,
        status: status.status,
        errorMessage: status.errorMessage,
      };
    });

    res.json({
      success: true,
      statuses: statusMap,
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    res.status(500).json({
      error: "Failed to get sync status",
      message: error.message,
    });
  }
});

export default router;
