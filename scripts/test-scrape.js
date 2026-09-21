"use strict";

// Manual verification script: fetch a real board's answers and print what was parsed.
// Usage: node scripts/test-scrape.js 04/09/2026

const { fetchAnswerKey } = require("../src/scrape/answerKey");
const model = require("../src/board/model");

async function main() {
  const date = process.argv[2];
  if (!date) {
    console.error("Usage: node scripts/test-scrape.js DD/MM/YYYY");
    process.exit(1);
  }

  const { url, entries } = await fetchAnswerKey(date);
  console.log("URL:", url);
  console.log("\n--- Parsed entries ---\n");
  console.log(JSON.stringify(entries, null, 2));
  console.log("\nTotal parsed:", Object.keys(entries).length);

  console.log("\n--- Length cross-check against grid ---\n");
  for (const [clueKey, text] of Object.entries(entries)) {
    const [number, direction] = clueKey.split(":");
    const entry = model.getEntry(Number(number), direction);
    if (!entry) {
      console.log(`${clueKey}: NO MATCHING GRID ENTRY (text="${text}")`);
      continue;
    }
    if (entry.length !== text.length) {
      console.log(
        `${clueKey}: length mismatch - grid=${entry.length} text="${text}" (len ${text.length})`,
      );
    }
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
