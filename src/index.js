// src/index.js
import express from "express";
import dotenv from "dotenv";
import stringsRouter from "./controllers/stringsController.js";
import { initMongo } from "./db/mongoClient.js";

dotenv.config();

console.log("Mongo URI:", process.env.MONGO_URI ? "Loaded ✅" : "Missing ❌");

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "String Analyzer API is running" });
});

// Health check
app.get("/_health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Attach strings routes
app.use("/", stringsRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

// Start
const PORT = process.env.PORT || 3030;

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await initMongo(mongoUri);
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start app:", err);
    process.exit(1);
  }
}

start();
