// src/controllers/stringsController.js
import express from "express";
import { getCollection } from "../db/mongoClient.js";
// Assumes analyze.js now exports the 6 required properties
import { analyzeString, MIN_LENGTH, MAX_LENGTH, sha256Hex } from "../analyze.js"; 
// Assumes nlParser.js now throws ParsingError with status 400/422
import { parseNaturalLanguageQuery } from "../parsers/nlParser.js"; 

const router = express.Router();

/**
 * Helper: standard response shape for a stored document
 */
function documentToResponse(doc) {
  return {
    id: doc._id,
    value: doc.value,
    properties: doc.properties,
    created_at: doc.created_at,
  };
}

// --------------------------------------------------------------------
// 1. POST /strings (Create/Analyze String)
// --------------------------------------------------------------------
router.post("/strings", async (req, res, next) => {
  try {
    const collection = getCollection();
    const { value } = req.body ?? {};

    if (value === undefined) {
      return res.status(400).json({ error: "Missing 'value' in request body." });
    }
    if (typeof value !== "string") {
      return res.status(422).json({ error: "'value' must be a string." });
    }

    const length = Array.from(value).length;
    if (length < MIN_LENGTH) {
      return res.status(400).json({ error: `String too short. Minimum length is ${MIN_LENGTH}.` });
    }
    if (length > MAX_LENGTH) {
      return res.status(400).json({ error: `String too long. Maximum length is ${MAX_LENGTH}.` });
    }

    const id = sha256Hex(value);

    // Check for conflict
    const existing = await collection.findOne({ _id: id });
    if (existing) {
      return res.status(409).json({
        error: "String already exists.",
        id: existing._id,
        value: existing.value,
      });
    }

    // Analyze string (pure function)
    const analyzed = analyzeString(value);

    // Prepare DB document; all required properties are in analyzed.properties
    const doc = {
      _id: analyzed.id,
      value: analyzed.value,
      properties: analyzed.properties,
      characters_array: analyzed.characters_array,
      created_at: analyzed.created_at,
    };

    await collection.insertOne(doc);

    // 201 Created response
    return res.status(201).json(documentToResponse(doc));
  } catch (err) {
    next(err);
  }
});


// --------------------------------------------------------------------
// 1. GET /strings/filter-by-natural-language (NL Filter)
// --------------------------------------------------------------------
router.get("/strings/filter-by-natural-language", async (req, res, next) => {
  try {
    const collection = getCollection();
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Missing 'query' parameter." });
    }

    // Use nlParser (which throws 400/422 errors)
    const interpreted = parseNaturalLanguageQuery(decodeURIComponent(query));
    const parsed = interpreted.parsed_filters;

    // Build mongo query just like the GET /strings route
    const mongoQuery = {};
    if (parsed.is_palindrome !== undefined) mongoQuery["properties.is_palindrome"] = parsed.is_palindrome;
    if (parsed.min_length !== undefined) mongoQuery["properties.length"] = { ...(mongoQuery["properties.length"] || {}), $gte: parsed.min_length };
    if (parsed.max_length !== undefined) mongoQuery["properties.length"] = { ...(mongoQuery["properties.length"] || {}), $lte: parsed.max_length };
    if (parsed.word_count !== undefined) mongoQuery["properties.word_count"] = parsed.word_count;
    if (parsed.contains_character !== undefined) mongoQuery["characters_array"] = parsed.contains_character;

    const docs = await collection.find(mongoQuery).sort({ created_at: -1 }).limit(100).toArray();
    return res.json({
      data: docs.map(documentToResponse),
      count: docs.length,
      interpreted_query: interpreted,
    });
  } catch (err) {
    // Catch errors from parseNaturalLanguageQuery
    if (err.status === 400 || err.status === 422) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});



// --------------------------------------------------------------------
// 3. GET /strings (Get All Strings with Filtering)
// --------------------------------------------------------------------
router.get("/strings", async (req, res, next) => {
  try {
    const collection = getCollection();
    const {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character,
      page = "1",
      limit = "20",
    } = req.query;

    const query = {};

    // Filter Logic (remains unchanged)
    // ...

    // Pagination Logic (remains unchanged)
    // ...
    
    // (Full filter/pagination implementation from original code is assumed here)

    if (is_palindrome !== undefined) {
      if (!["true", "false"].includes(String(is_palindrome).toLowerCase())) {
        return res.status(400).json({ error: "is_palindrome must be 'true' or 'false'." });
      }
      query["properties.is_palindrome"] = String(is_palindrome).toLowerCase() === "true";
    }

    if (min_length !== undefined) {
      const v = Number(min_length);
      if (!Number.isInteger(v)) return res.status(400).json({ error: "min_length must be integer." });
      query["properties.length"] = { ...(query["properties.length"] || {}), $gte: v };
    }

    if (max_length !== undefined) {
      const v = Number(max_length);
      if (!Number.isInteger(v)) return res.status(400).json({ error: "max_length must be integer." });
      query["properties.length"] = { ...(query["properties.length"] || {}), $lte: v };
    }

    if (word_count !== undefined) {
      const v = Number(word_count);
      if (!Number.isInteger(v)) return res.status(400).json({ error: "word_count must be integer." });
      query["properties.word_count"] = v;
    }

    if (contains_character !== undefined) {
      if (typeof contains_character !== "string" || contains_character.length === 0) {
        return res.status(400).json({ error: "contains_character must be a non-empty single character." });
      }
      const ch = contains_character[0];
      query["characters_array"] = ch;
    }
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const cursor = collection.find(query).sort({ created_at: -1 }).skip(skip).limit(limitNum);
    const dataDocs = await cursor.toArray();
    const count = await collection.countDocuments(query);

    return res.json({
      data: dataDocs.map(documentToResponse),
      count,
      filters_applied: {
        is_palindrome: is_palindrome === undefined ? undefined : String(is_palindrome).toLowerCase() === "true",
        min_length: min_length === undefined ? undefined : Number(min_length),
        max_length: max_length === undefined ? undefined : Number(max_length),
        word_count: word_count === undefined ? undefined : Number(word_count),
        contains_character: contains_character === undefined ? undefined : String(contains_character)[0],
      },
    });
  } catch (err) {
    next(err);
  }
});


// --------------------------------------------------------------------
// 4. GET /strings/:value (Get Specific String)
// --------------------------------------------------------------------
router.get("/strings/:value", async (req, res, next) => {
  try {
    const collection = getCollection();
    const raw = req.params.value;
    if (!raw) {
      return res.status(400).json({ error: "Missing string value in path." });
    }
    
    const decoded = decodeURIComponent(raw);
    const id = sha256Hex(decoded);

    const doc = await collection.findOne({ _id: id });
    if (!doc) {
      return res.status(404).json({ error: "String not found." });
    }
    return res.json(documentToResponse(doc));
  } catch (err) {
    next(err);
  }
});


// --------------------------------------------------------------------
// 5. DELETE /strings/:value (Delete String)
// --------------------------------------------------------------------
router.delete("/strings/:value", async (req, res, next) => {
  try {
    const collection = getCollection();
    const raw = req.params.value;

    if (!raw) {
      return res.status(400).json({ error: "Missing string value in path." });
    }

    const decoded = decodeURIComponent(raw);
    const id = sha256Hex(decoded);

    const result = await collection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "String not found." });
    }

    // 204 No Content response
    return res.status(204).send();

  } catch (err) {
    next(err);
  }
});


export default router;