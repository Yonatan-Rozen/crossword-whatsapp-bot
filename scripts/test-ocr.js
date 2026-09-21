"use strict";

// Manual verification script: run OCR against a sample board photo.
// Usage: node scripts/test-ocr.js path/to/photo.jpg

const fs = require("fs");
const { extractDateFromImage } = require("../src/ocr/dateFromImage");

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/test-ocr.js path/to/photo.jpg");
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const { date, rawText } = await extractDateFromImage(buffer);
  console.log("Extracted date:", date);
  console.log("\n--- Raw OCR text ---\n");
  console.log(rawText);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
