// src/parsers/nlParser.js
// Simple rule-based parser to turn short NL queries into filter objects.
// Example: "all single word palindromic strings" -> { word_count: 1, is_palindrome: true }

export function parseNaturalLanguageQuery(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty natural language query");
  }

  const original = raw;
  const text = raw.toLowerCase();

  const filters = {};
  const collisions = [];

  // rule: palindromic / palindrome
  if (text.match(/\bpalindrom/)) filters.is_palindrome = true;

  // rule: single word / one word
  if (text.match(/\b(single|one)\s+word\b/)) filters.word_count = 1;

  // rule: word count explicit "words" - capture "exactly N words" or "N word(s)"
  const wordMatch = text.match(/(?:exactly\s+)?(\d+)\s+words?/);
  if (wordMatch) filters.word_count = Number(wordMatch[1]);

  // rule: longer than N characters
  const longerMatch = text.match(/longer than (\d+)/);
  if (longerMatch) {
    const v = Number(longerMatch[1]) + 1; // "longer than 10" => min_length 11
    filters.min_length = v;
  }

  // rule: shorter than N characters
  const shorterMatch = text.match(/shorter than (\d+)/);
  if (shorterMatch) {
    const v = Number(shorterMatch[1]) - 1; // "shorter than 10" => max_length 9
    filters.max_length = v;
  }

  // rule: "strings containing the letter x" or "containing x"
  const containsLetter = text.match(/contains(?: the)? (?:letter )?(['"]?)([a-z0-9])\1/);
  if (containsLetter) {
    filters.contains_character = containsLetter[2];
  } else {
    // also support "containing the letter a" or "contain z"
    const containsLetter2 = text.match(/\bcontaining (?:the )?letter ([a-z0-9])\b/);
    if (containsLetter2) filters.contains_character = containsLetter2[1];
  }

  // If nothing parsed, fail
  if (Object.keys(filters).length === 0) {
    const err = new Error("Unable to parse natural language query");
    err.status = 400;
    throw err;
  }

  // Validate logical consistency (simple checks)
  if (filters.min_length !== undefined && filters.max_length !== undefined) {
    if (filters.min_length > filters.max_length) {
      const err = new Error("Parsed filters are conflicting (min_length > max_length)");
      err.status = 422;
      throw err;
    }
  }

  // Return interpreted query object
  return {
    original,
    parsed_filters: filters,
  };
}
