// src/parsers/nlParser.js
// Simple rule-based parser to turn short NL queries into filter objects.

/**
 * Custom error class for parsing issues that should result in specific HTTP codes.
 */
class ParsingError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'ParsingError';
        this.status = status;
    }
}

/**
 * Compute SHA-256 hex digest for input string.
 */
export function parseNaturalLanguageQuery(raw) {
    if (!raw || typeof raw !== "string") {
        throw new ParsingError("Empty natural language query", 400);
    }

    const original = raw;
    const text = raw.toLowerCase();

    const filters = {};

    // --- 1. Boolean and Simple Checks ---

    // rule: palindromic / palindrome
    if (text.match(/\bpalindrom/)) filters.is_palindrome = true;

    // rule: single word / one word (Set to 1, conflicts handled later)
    if (text.match(/\b(single|one)\s+word\b/)) filters.word_count = 1;

    // rule: word count explicit "words" - capture "exactly N words" or "N word(s)"
    // NOTE: This captures 'exactly 3 words' and may override 'single word'. Order matters.
    const wordMatch = text.match(/(?:exactly\s+)?(\d+)\s+words?/);
    if (wordMatch) {
        const parsedWordCount = Number(wordMatch[1]);
        if (filters.word_count && filters.word_count !== parsedWordCount) {
             throw new ParsingError("Query contains conflicting word count requirements.", 422);
        }
        filters.word_count = parsedWordCount;
    }


    // --- 2. Length Checks ---

    let min_length_val;
    let max_length_val;

    // rule: longer than N characters
    const longerMatch = text.match(/longer than (\d+)(?:\s+chars?)?/);
    if (longerMatch) {
        min_length_val = Number(longerMatch[1]) + 1; // "longer than 10" => min_length 11
    }

    // rule: shorter than N characters
    const shorterMatch = text.match(/shorter than (\d+)(?:\s+chars?)?/);
    if (shorterMatch) {
        max_length_val = Number(shorterMatch[1]) - 1; // "shorter than 10" => max_length 9
    }

    // rule: exactly N characters (If present, overrides min/max)
    const exactMatch = text.match(/\b(\d+)\s+chars?\b/); // Matches "10 characters" but might need refinement
    if (exactMatch && !longerMatch && !shorterMatch) {
        min_length_val = Number(exactMatch[1]);
        max_length_val = Number(exactMatch[1]);
    }
    
    if (min_length_val !== undefined) filters.min_length = min_length_val;
    if (max_length_val !== undefined) filters.max_length = max_length_val;


    // --- 3. Contains Character Check (contains_character) ---

    // rule: Heuristic for "first vowel" -> 'a'
    if (text.includes("first vowel") || text.includes("initial vowel")) {
        filters.contains_character = 'a';
    }

    // rule: explicit "strings containing the letter z" or "containing z"
    // Capture single character 'a' or 'z' after "contains"
    // Also captures single letter from 'letter a' or 'character a'
    const containsMatch = text.match(/(?:contain|containing)(?:s)?\s+(?:the\s+(?:letter|character)\s+)?(['"]?)([a-z])\1/);
    if (containsMatch) {
        // If a character was already set (e.g., by the "first vowel" heuristic),
        // we assume the explicit character is the final intent.
        filters.contains_character = containsMatch[2];
    }
    
    // --- 4. Validation & Error Handling ---

    // If nothing parsed, fail (400 Bad Request)
    if (Object.keys(filters).length === 0) {
        throw new ParsingError("Unable to parse natural language query", 400);
    }

    // Validate logical consistency (422 Unprocessable Entity)
    if (filters.min_length !== undefined && filters.max_length !== undefined) {
        if (filters.min_length > filters.max_length) {
            throw new ParsingError("Parsed filters are conflicting (min_length > max_length)", 422);
        }
    }

    // Return interpreted query object
    return {
        original,
        parsed_filters: filters,
    };
}