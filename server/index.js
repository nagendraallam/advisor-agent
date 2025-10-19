// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// NOW import everything else AFTER environment variables are loaded
import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import chatRoutes from "./routes/chat.js";
import syncRoutes from "./routes/sync.js";
import embeddingsRoutes from "./routes/embeddings.js";
import { initializePassport } from "./config/passport.js";
import { connectDB } from "./config/db.js";
import { initializeSyncJob } from "./services/sync.service.js";
import { startEmailMonitoring } from "./services/emailMonitoring.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the root directory (one level up from server/)

// wait for .env to be loaded

dotenv.config({ path: path.join(__dirname, "../.env") });

console.log(process.env.DATABASE_URL);

// Initialize Passport strategies
initializePassport();

const app = express();
const PORT = process.env.PORT || 8080;

// Connect to PostgreSQL
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/embeddings", embeddingsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);

  // Initialize background jobs
  if (process.env.NODE_ENV !== "test") {
    try {
      initializeSyncJob();
      console.log("✅ Background sync job initialized");
    } catch (error) {
      console.error("❌ Failed to initialize sync job:", error);
    }

    try {
      startEmailMonitoring();
      console.log("✅ Email monitoring service started");
    } catch (error) {
      console.error("❌ Failed to start email monitoring:", error);
    }
  }
});
