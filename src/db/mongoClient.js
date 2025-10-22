// src/db/mongoClient.js
import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGO_DB_NAME || "string_analyzer";
const COLLECTION_NAME = process.env.MONGO_COLLECTION || "analyzed_strings";

let client;
let collection;

export async function initMongo(mongoUri) {
  if (!mongoUri) throw new Error("MONGO_URI is required in environment variables");

  // Prevent reconnecting if already connected
  if (client && collection) return collection;

  try {
    // ✅ Add this configuration object
    client = new MongoClient(mongoUri);


    await client.connect();

    const db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);

    // Useful indexes for performance
    await Promise.all([
      collection.createIndex({ created_at: -1 }),
      collection.createIndex({ characters_array: 1 }),
      collection.createIndex({ "properties.is_palindrome": 1 }),
      collection.createIndex({ "properties.length": 1 }),
    ]);

    console.log(`✅ MongoDB connected to database "${DB_NAME}"`);
    return collection;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    throw err;
  }
}

export function getCollection() {
  if (!collection) throw new Error("Mongo collection not initialized. Call initMongo first.");
  return collection;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    collection = null;
  }
}
