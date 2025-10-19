import express from "express";

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.user) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
};

// Get user profile
router.get("/profile", isAuthenticated, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    avatar: req.user.avatar,
    hubspotConnected: req.user.hubspotConnected,
    createdAt: req.user.createdAt,
  });
});

// Disconnect HubSpot
router.post("/disconnect-hubspot", isAuthenticated, async (req, res) => {
  try {
    req.user.hubspotAccessToken = null;
    req.user.hubspotRefreshToken = null;
    req.user.hubspotConnected = false;
    req.user.hubspotPortalId = null;
    await req.user.save();

    res.json({ success: true, message: "HubSpot disconnected successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to disconnect HubSpot" });
  }
});

export default router;
