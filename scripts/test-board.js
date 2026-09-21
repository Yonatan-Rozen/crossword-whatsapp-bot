"use strict";

// Manual verification: prints a sample dynamically-solved board's ASCII numbering.
const { buildBoard } = require("../src/board/model");

const SAMPLE_ROWS = [
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

const board = buildBoard(SAMPLE_ROWS);
console.log(board.renderTextBoard());
console.log("\nTotal clue slots (across+down):", board.allClueKeys().length);
