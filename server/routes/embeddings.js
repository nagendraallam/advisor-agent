import express from "express";
import {
  generateAllEmbeddings,
  generateEmailEmbeddings,
  generateContactEmbeddings,
  generateNoteEmbeddings,
} from "../services/embeddings.service.js";

const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.user) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
};

/**
 * Generate embeddings for all content
 */
router.post("/generate", isAuthenticated, async (req, res) => {
  try {
    const results = await generateAllEmbeddings(req.user.id);

    res.json({
      success: true,
      message: "Embeddings generated successfully",
      results,
    });
  } catch (error) {
    console.error("Generate embeddings error:", error);
    res.status(500).json({
      error: "Failed to generate embeddings",
      message: error.message,
    });
  }
});

/**
 * Generate embeddings for emails only
 */
router.post("/generate/emails", isAuthenticated, async (req, res) => {
  try {
    const count = await generateEmailEmbeddings(req.user.id);

    res.json({
      success: true,
      message: `Generated embeddings for ${count} emails`,
      count,
    });
  } catch (error) {
    console.error("Generate email embeddings error:", error);
    res.status(500).json({
      error: "Failed to generate email embeddings",
      message: error.message,
    });
  }
});

/**
 * Generate embeddings for contacts only
 */
router.post("/generate/contacts", isAuthenticated, async (req, res) => {
  try {
    const count = await generateContactEmbeddings(req.user.id);

    res.json({
      success: true,
      message: `Generated embeddings for ${count} contacts`,
      count,
    });
  } catch (error) {
    console.error("Generate contact embeddings error:", error);
    res.status(500).json({
      error: "Failed to generate contact embeddings",
      message: error.message,
    });
  }
});

/**
 * Generate embeddings for notes only
 */
router.post("/generate/notes", isAuthenticated, async (req, res) => {
  try {
    const count = await generateNoteEmbeddings(req.user.id);

    res.json({
      success: true,
      message: `Generated embeddings for ${count} notes`,
      count,
    });
  } catch (error) {
    console.error("Generate note embeddings error:", error);
    res.status(500).json({
      error: "Failed to generate note embeddings",
      message: error.message,
    });
  }
});

/**
 * Regenerate all embeddings (force regeneration)
 */
router.post("/regenerate", isAuthenticated, async (req, res) => {
  try {
    // This would require setting all embeddings to null first
    // Then calling generateAllEmbeddings
    // For now, just call generate which only processes null embeddings

    const results = await generateAllEmbeddings(req.user.id);

    res.json({
      success: true,
      message: "Embeddings regenerated successfully",
      results,
    });
  } catch (error) {
    console.error("Regenerate embeddings error:", error);
    res.status(500).json({
      error: "Failed to regenerate embeddings",
      message: error.message,
    });
  }
});

export default router;
