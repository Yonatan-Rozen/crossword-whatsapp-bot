"use strict";

// Manual verification script: resolve a board request (URL or free text) and print what
// was scraped.
// Usage: node scripts/test-scrape.js "https://www.14across.co.il/answers.php?crossword=12&..."
//        node scripts/test-scrape.js "לוח תרתי משמע 04/09/2026"

const { fetchAnswerKey } = require("../src/scrape/answerKey");
const { parseBoardRequest } = require("../src/scrape/boardRequest");

async function main() {
  const text = process.argv.slice(2).join(" ");
  if (!text) {
    console.error('Usage: node scripts/test-scrape.js "<url or free text>"');
    process.exit(1);
  }

  const request = await parseBoardRequest(text);
  if (!request) {
    console.error("Could not parse a board request from that text.");
    process.exit(1);
  }
  console.log("Parsed request:", request);

  const { url, entries, resolvedDate, resolvedTitle } =
    await fetchAnswerKey(request);
  console.log("URL:", url);
  console.log(
    "Resolved title:",
    resolvedTitle,
    "| Resolved date:",
    resolvedDate,
  );
  console.log("\n--- Parsed entries ---\n");
  console.log(JSON.stringify(entries, null, 2));
  console.log("\nTotal parsed:", Object.keys(entries).length);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
