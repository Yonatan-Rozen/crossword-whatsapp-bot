"use strict";

// Shared crossword grid model - ported from crossword_board.py (kept there as reference only).
// Source of truth for the fixed black-cell layout, clue numbering, and per-clue cell spans.

const BOARD_ROWS = [
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

const ROWS = BOARD_ROWS.length;
const COLS = BOARD_ROWS[0].length;

function isBlack(row, col) {
  return BOARD_ROWS[row][col] === "#";
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function acrossStartsAt(row, col) {
  return (
    (col === COLS - 1 || isBlack(row, col + 1)) &&
    col - 1 >= 0 &&
    !isBlack(row, col - 1)
  );
}

function downStartsAt(row, col) {
  return (
    (row === 0 || isBlack(row - 1, col)) &&
    row + 1 < ROWS &&
    !isBlack(row + 1, col)
  );
}

// Numbering matches crossword_board.py: scan each row right-to-left, number cells that
// start an across or down entry.
function generateNumbering() {
  const numbering = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let current = 0;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = COLS - 1; col >= 0; col -= 1) {
      if (isBlack(row, col)) continue;

      if (acrossStartsAt(row, col) || downStartsAt(row, col)) {
        current += 1;
        numbering[row][col] = current;
      }
    }
  }

  return numbering;
}

// For each numbered cell, compute the full cell span (and length) of any across/down
// entry that starts there. Must reuse the exact same start conditions as generateNumbering:
// the grid is Hebrew/RTL, so an across entry is numbered at its RIGHTMOST cell and its
// span extends leftward (decreasing col); down entries are numbered at the top and extend
// downward as usual.
function generateEntries(numbering) {
  const entries = {};

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const number = numbering[row][col];
      if (number === null) continue;

      entries[number] = entries[number] || {};

      if (acrossStartsAt(row, col)) {
        const cells = [];
        let c = col;
        while (inBounds(row, c) && !isBlack(row, c)) {
          cells.push([row, c]);
          c -= 1;
        }
        entries[number].across = { cells, length: cells.length };
      }

      if (downStartsAt(row, col)) {
        const cells = [];
        let r = row;
        while (inBounds(r, col) && !isBlack(r, col)) {
          cells.push([r, col]);
          r += 1;
        }
        entries[number].down = { cells, length: cells.length };
      }
    }
  }

  return entries;
}

const BOARD_NUMBERS = generateNumbering();
const ENTRIES = generateEntries(BOARD_NUMBERS);

function renderTextBoard() {
  const lines = [];
  for (let row = 0; row < ROWS; row += 1) {
    const cells = [];
    for (let col = 0; col < COLS; col += 1) {
      const number = BOARD_NUMBERS[row][col];
      if (isBlack(row, col)) cells.push("##");
      else if (number === null) cells.push("..");
      else cells.push(String(number).padStart(2, "0"));
    }
    lines.push(cells.join(" "));
  }
  return lines.join("\n");
}

function getEntry(number, direction) {
  const dirKey =
    direction === "מאוזן"
      ? "across"
      : direction === "מאונך"
        ? "down"
        : direction;
  const entry = ENTRIES[number];
  if (!entry) return null;
  return entry[dirKey] || null;
}

// Every distinct clue number+direction that exists on this board (used to detect full completion).
function allClueKeys() {
  const keys = [];
  for (const [number, dirs] of Object.entries(ENTRIES)) {
    if (dirs.across) keys.push(`${number}:מאוזן`);
    if (dirs.down) keys.push(`${number}:מאונך`);
  }
  return keys;
}

module.exports = {
  ROWS,
  COLS,
  BOARD_ROWS,
  BOARD_NUMBERS,
  ENTRIES,
  isBlack,
  renderTextBoard,
  getEntry,
  allClueKeys,
};
