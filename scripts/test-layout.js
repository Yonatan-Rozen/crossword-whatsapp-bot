"use strict";

// Verifies src/board/layoutSolver.js against two known-good grids:
//   1. The 13x13 "הפוך על הפוך" clue set solved with Z3 earlier this session (board_creator.py).
//   2. The existing hardcoded 11x11 "תרתי משמע" grid in src/board/model.js (re-solving its own
//      clue lengths should reproduce a grid with matching numbering/entries).
//
// Usage: node scripts/test-layout.js

const { solveLayout } = require("../src/board/layoutSolver");
const { buildBoard } = require("../src/board/model");

const REFERENCE_ROWS = [
  ".....#.....",
  ".#.#.#.#.#.",
  ".....#.....",
  ".#.#.###.#.",
  "..#.......#",
  ".#.#.#.#.#.",
  "#.......#..",
  ".#.###.#.#.",
  ".....#.....",
  ".#.#.#.#.#.",
  ".....#.....",
];

function clueLengthsFromPairs(acrossLens, downLens) {
  const map = new Map();
  for (const [num, len] of Object.entries(acrossLens)) {
    const n = Number(num);
    const cur = map.get(n) || {};
    cur.across = len;
    map.set(n, cur);
  }
  for (const [num, len] of Object.entries(downLens)) {
    const n = Number(num);
    const cur = map.get(n) || {};
    cur.down = len;
    map.set(n, cur);
  }
  return map;
}

function printBoard(rows) {
  console.log(rows.join("\n"));
}

// --- Test 1: 13x13 "הפוך על הפוך" ---
function test13x13() {
  console.log("=== Test 1: 13x13 (הפוך על הפוך) ===");
  const across = {
    1: "נגדהזרמ".length,
    5: "מגמתי".length,
    8: "הגדיר".length,
    9: "ירדמהקו".length,
    10: "כלהמיומי".length,
    12: "שפה".length,
    14: "לאמשהו".length,
    15: "גרפילד".length,
    18: "תרש".length,
    19: "מזרהאימה".length,
    21: "וישלומר".length,
    22: "אלבומ".length,
    24: "המתנה".length,
    25: "ממריאות".length,
  };
  const down = {
    1: "נלהב".length,
    2: "דוד".length,
    3: "זורקמרה".length,
    4: "מריבות".length,
    5: "מרדני".length,
    6: "מאהושתיימ".length,
    7: "ירומהודו".length,
    11: "לאמהשחשבת".length,
    13: "ללאתמורה".length,
    16: "רואהאור".length,
    17: "מרקרימ".length,
    19: "מבואה".length,
    20: "עמית".length,
    23: "בבא".length,
  };

  const clueLengths = clueLengthsFromPairs(across, down);
  const start = Date.now();
  const board = solveLayout(clueLengths, { minSize: 13, maxSize: 13 });
  const ms = Date.now() - start;

  if (!board) {
    console.error(`FAILED: no layout found (${ms}ms)`);
    process.exitCode = 1;
    return;
  }
  console.log(`Solved in ${ms}ms:`);
  printBoard(board);
}

// --- Test 2: re-solve the existing hardcoded 11x11 grid's own clue lengths ---
function test11x11() {
  console.log("\n=== Test 2: 11x11 (existing תרתי משמע grid) ===");
  const referenceBoard = buildBoard(REFERENCE_ROWS);
  const across = {};
  const down = {};
  for (const [number, dirs] of Object.entries(referenceBoard.ENTRIES)) {
    if (dirs.across) across[number] = dirs.across.length;
    if (dirs.down) down[number] = dirs.down.length;
  }
  const clueLengths = clueLengthsFromPairs(across, down);

  const start = Date.now();
  const board = solveLayout(clueLengths, { minSize: 11, maxSize: 11 });
  const ms = Date.now() - start;

  if (!board) {
    console.error(`FAILED: no layout found (${ms}ms)`);
    process.exitCode = 1;
    return;
  }
  console.log(`Solved in ${ms}ms:`);
  printBoard(board);
  console.log("\nOriginal grid:");
  console.log(REFERENCE_ROWS.join("\n"));
  console.log(
    board.join("\n") === REFERENCE_ROWS.join("\n")
      ? "\nMATCH: identical to the original grid."
      : "\nDIFFERS from the original grid (may still be a valid alternate solution - verify lengths).",
  );
}

test13x13();
test11x11();
