import express from "express";
import passport from "passport";
import axios from "axios";
import User from "../models/User.js";

const router = express.Router();

// Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    accessType: "offline",
    prompt: "consent",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login",
  }),
  (req, res) => {
    // Successful authentication
    res.redirect("http://localhost:5173" + "/dashboard");
  }
);

// HubSpot OAuth - Initiate
router.get("/hubspot", (req, res) => {
  if (!req.user) {
    console.log("User not found");
    return res.redirect(`${process.env.CLIENT_URL}/login`);
  }

  console.log("User found");
  console.log(process.env.HUBSPOT_CLIENT_ID);
  console.log(process.env.HUBSPOT_CALLBACK_URL);
  console.log(process.env.CLIENT_URL);

  const scopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.companies.read",
    "crm.objects.companies.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "crm.schemas.contacts.read",
    "crm.schemas.companies.read",
    "crm.schemas.deals.read",
    "crm.schemas.companies.write",
    "crm.schemas.contacts.write",
    "crm.schemas.deals.write",
  ].join(" ");

  const hubspotAuthUrl = `https://app-na2.hubspot.com/oauth/authorize?client_id=${
    process.env.HUBSPOT_CLIENT_ID
  }&redirect_uri=${process.env.HUBSPOT_CALLBACK_URL}&scope=${encodeURIComponent(
    scopes
  )}`;

  console.log(hubspotAuthUrl);

  res.redirect(hubspotAuthUrl);
});

// HubSpot OAuth - Callback
router.get("/hubspot/callback", async (req, res) => {
  const { code } = req.query;

  if (!req.user) {
    return res.redirect(`${process.env.CLIENT_URL}/login`);
  }

  if (!code) {
    return res.redirect(
      `${process.env.CLIENT_URL}/dashboard?error=hubspot_auth_failed`
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://api.hubapi.com/oauth/v1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        redirect_uri: process.env.HUBSPOT_CALLBACK_URL,
        code: code,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Get HubSpot account info
    const accountInfo = await axios.get(
      "https://api.hubapi.com/oauth/v1/access-tokens/" + access_token
    );

    // Update user with HubSpot credentials
    await User.update(
      {
        hubspotAccessToken: access_token,
        hubspotRefreshToken: refresh_token,
        hubspotConnected: true,
        hubspotPortalId: accountInfo.data.hub_id,
      },
      {
        where: { id: req.user.id },
      }
    );

    res.redirect(`${process.env.CLIENT_URL}/chat`);
  } catch (error) {
    console.error(
      "HubSpot OAuth error:",
      error.response?.data || error.message
    );
    res.redirect(
      `${process.env.CLIENT_URL}/dashboard?error=hubspot_connection_failed`
    );
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.redirect(process.env.CLIENT_URL);
  });
});

// Check auth status
router.get("/status", (req, res) => {
  if (req.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        hubspotConnected: req.user.hubspotConnected,
      },
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Test endpoint: Create a phantom user
router.post("/create-test-user", async (req, res) => {
  try {
    const randomId = Math.random().toString(36).substring(7);
    const testUser = await User.create({
      googleId: `test-${randomId}`,
      email: `test-${randomId}@example.com`,
      name: `Test User ${randomId}`,
      avatar: null,
      googleAccessToken: "fake-access-token",
      googleRefreshToken: "fake-refresh-token",
      hubspotAccessToken: null,
      hubspotRefreshToken: null,
      hubspotConnected: false,
      hubspotPortalId: null,
    });

    res.json({
      success: true,
      message: "Test user created",
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
      },
    });
  } catch (error) {
    console.error("Error creating test user:", error);
    res.status(500).json({
      error: "Failed to create test user",
      message: error.message,
    });
  }
});

export default router;
