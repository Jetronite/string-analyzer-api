// src/analyze.js
import crypto from "crypto";

/**
 * Settings
 */
export const MIN_LENGTH = 1;
export const MAX_LENGTH = 5000;

/**
 * Compute SHA-256 hex digest for input string.
 */
export function sha256Hex(value) {
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Count word occurrences and produce word_count.
 */
function computeWordCount(value) {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    // Split on any sequence of whitespace characters
    return trimmed.split(/\s+/).length;
}

/**
 * Build a frequency map for characters exactly as they appear.
 */
function computeCharacterFrequencyMap(value) {
    const map = Object.create(null);
    for (const ch of value) {
        map[ch] = (map[ch] || 0) + 1;
    }
    return map;
}

/**
 * Check palindrome (case-insensitive)
 */
function computeIsPalindrome(value) {
    const lower = value.toLowerCase();
    // Array.from handles Unicode/graphemes better than simple charAt/split
    const reversed = Array.from(lower).reverse().join("");
    return lower === reversed;
}

/**
 * Return unique characters as an integer and an array list for DB indexing.
 */
function computeUniqueCharactersAndArray(value) {
    const set = new Set(Array.from(value));
    return { uniqueCount: set.size, charactersArray: Array.from(set) };
}

/**
 * analyzeString(value) -> returns object with properties per spec
 */
export function analyzeString(value) {
    if (typeof value !== "string") {
        throw new TypeError("analyzeString expects a string");
    }

    const length = Array.from(value).length;
    const is_palindrome = computeIsPalindrome(value);
    const word_count = computeWordCount(value);
    const sha256_hash = sha256Hex(value);
    const character_frequency_map = computeCharacterFrequencyMap(value);
    const { uniqueCount: unique_characters, charactersArray } = computeUniqueCharactersAndArray(value);

    return {
        id: sha256_hash,
        value,
        properties: {
            length,
            is_palindrome,
            unique_characters,
            word_count,
            sha256_hash, // ⬅️ CRUCIAL ADDITION FOR 201 RESPONSE STRUCTURE
            character_frequency_map,
        },
        characters_array: charactersArray,
        created_at: new Date().toISOString(),
    };
}