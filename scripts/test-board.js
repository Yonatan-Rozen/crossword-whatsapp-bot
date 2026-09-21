"use strict";

// Manual verification: compare ported JS grid numbering against crossword_board.py's render_board().
const { renderTextBoard, allClueKeys } = require("../src/board/model");

console.log(renderTextBoard());
console.log("\nTotal clue slots (across+down):", allClueKeys().length);
