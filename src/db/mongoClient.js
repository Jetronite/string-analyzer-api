// src/db/mongoClient.js
import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGO_DB_NAME || "string_analyzer";
const COLLECTION_NAME = process.env.MONGO_COLLECTION || "analyzed_strings";

let client;
let collection;

/**
 * Initialize MongoDB client and return the collection handle.
 * Call once during app startup.
 */
export async function initMongo(mongoUri) {
  if (!mongoUri) {
    throw new Error("MONGO_URI is required in environment variables");
  }
  if (client && collection) return collection;

  client = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();

  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);

  // Useful indexes:
  // _id (sha256) is unique by default; ensure created_at index for sort, and characters_array for fast contains_character queries
  await collection.createIndex({ created_at: -1 });
  await collection.createIndex({ characters_array: 1 });
  await collection.createIndex({ "properties.is_palindrome": 1 });
  await collection.createIndex({ "properties.length": 1 });

  return collection;
}

export function getCollection() {
  if (!collection) {
    throw new Error("Mongo collection not initialized. Call initMongo first.");
  }
  return collection;
}

/**
 * Close client (useful for tests / graceful shutdown)
 */
export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    collection = null;
  }
}
