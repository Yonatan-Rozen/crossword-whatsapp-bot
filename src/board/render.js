"use strict";

// Renders the current board state (solved letters filled in, rest blank) as a PNG,
// reusing the visual style of crossword_board.html.

const { chromium } = require("playwright");
const {
  ROWS,
  COLS,
  BOARD_ROWS,
  BOARD_NUMBERS,
  ENTRIES,
  isBlack,
} = require("./model");

const STYLE = `
  :root {
    --paper: #f6f0e6; --ink: #1f1a17; --muted: #6f6258;
    --gold: #c98a42; --gold-deep: #9d642d; --line: #2a231f; --black: #16120f; --white: #fffdf8;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif; background: var(--paper);
    display: grid; place-items: center; padding: 24px; }
  .poster { width: 720px; background: #fff; border-radius: 20px; box-shadow: 0 16px 48px rgba(0,0,0,.18); padding: 20px; }
  .topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 12px; }
  .date { font-size: 1.6rem; font-weight: 800; color: #e5432f; }
  .title { flex: 1; text-align: center; background: linear-gradient(180deg,#d98f5a,var(--gold)); color: #fff;
    padding: 10px 16px; border-radius: 14px; font-weight: 800; }
  .board { width: 100%; aspect-ratio: 1/1; direction: ltr; display: grid; grid-template-columns: repeat(${COLS}, 1fr);
    grid-template-rows: repeat(${ROWS}, 1fr); border: 4px solid var(--line); background: var(--line); }
  .cell { position: relative; border: 1px solid var(--line); background: var(--white); }
  .cell.black { background: var(--black); }
  .number { position: absolute; top: 2px; right: 3px; font-size: 10px; font-weight: 800; color: var(--ink); }
  .letter { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 400;
    font-family: 'Playpen Sans Hebrew', 'Trebuchet MS', cursive; font-size: clamp(22px, 6.5vw, 40px); color: #d8232a; }
  .footnote { text-align: center; color: var(--muted); font-weight: 700; padding-top: 10px; }
`;

// Strips spaces/punctuation so a multi-word phrase can still be laid into single grid cells.
function lettersOnly(text) {
  return text.replace(/[^\p{L}]/gu, "");
}

function computeLetterGrid(solved) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  for (const [clueKey, entry] of Object.entries(solved)) {
    const [numberStr, direction] = clueKey.split(":");
    const number = Number(numberStr);
    const dirKey = direction === "מאוזן" ? "across" : "down";
    const span = ENTRIES[number] && ENTRIES[number][dirKey];
    if (!span) continue;

    const letters = lettersOnly(entry.text);
    if (letters.length !== span.length) continue; // mismatched length, skip rendering letters

    span.cells.forEach(([r, c], i) => {
      grid[r][c] = letters[i];
    });
  }

  return grid;
}

function buildBoardHtml({ date, solved, caption }) {
  const letterGrid = computeLetterGrid(solved || {});

  let cellsHtml = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (isBlack(row, col)) {
        cellsHtml += '<div class="cell black"></div>';
        continue;
      }
      const number = BOARD_NUMBERS[row][col];
      const letter = letterGrid[row][col];
      cellsHtml +=
        '<div class="cell">' +
        (number !== null ? `<span class="number">${number}</span>` : "") +
        (letter ? `<span class="letter">${letter}</span>` : "") +
        "</div>";
    }
  }

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playpen+Sans+Hebrew&display=swap" rel="stylesheet" />
  <style>${STYLE}</style></head>
<body>
  <main class="poster">
    <section class="topbar">
      <div class="date">${date || ""}</div>
      <div class="title">לוח התשבץ</div>
    </section>
    <div class="board">${cellsHtml}</div>
    <div class="footnote">${caption || ""}</div>
  </main>
</body></html>`;
}

async function renderBoardImage(boardData) {
  const html = buildBoardHtml(boardData);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 900 },
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready); // ensure the web font is actually painted, not just requested
    return await page.screenshot({ fullPage: true });
  } finally {
    await browser.close();
  }
}

module.exports = { buildBoardHtml, renderBoardImage, computeLetterGrid };
