"use strict";

// One-off sanity check: render a board with all real solved answers filled in.
const fs = require("fs");
const { renderBoardImage } = require("../src/board/render");

async function main() {
  const { entries } = await require("../src/scrape/answerKey").fetchAnswerKey(
    "19/06/2026",
  );
  const solved = {};
  for (const [clueKey, text] of Object.entries(entries)) {
    solved[clueKey] = { solverJid: "test", text, ts: Date.now() };
  }

  const buffer = await renderBoardImage({
    date: "19/06/2026",
    solved,
    caption: "בדיקה מלאה",
  });
  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/render-test.png", buffer);
  console.log("Wrote data/render-test.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
