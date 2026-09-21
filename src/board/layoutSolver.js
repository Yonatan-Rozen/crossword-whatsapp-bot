"use strict";

// Reverse-engineers a crossword grid's black/white cell layout from just the clue numbers
// and their across/down solution lengths - a pure-JS port of board_creator.py's Z3 model
// (180 deg rotational symmetry + right-to-left row-major numbering + exact entry lengths),
// implemented as a row-by-row backtracking search instead of a SAT solve.
//
// Numbering/start semantics must stay identical to src/board/model.js's acrossStartsAt/
// downStartsAt (Hebrew/RTL: an across entry is numbered at its RIGHTMOST cell and extends
// leftward; a down entry is numbered at its TOPmost cell and extends downward).

function reverseArr(arr) {
  return arr.slice().reverse();
}

// Across-starts within a single, fully-known row: white cell, right neighbor black/boundary,
// left neighbor white (so the run has length >= 2). Returns Map<col, length>.
function acrossInfoForRow(row) {
  const size = row.length;
  const info = new Map();
  for (let c = 0; c < size; c += 1) {
    if (!row[c]) continue;
    const rightBlack = c === size - 1 || !row[c + 1];
    const leftWhite = c - 1 >= 0 && row[c - 1];
    if (rightBlack && leftWhite) {
      let length = 0;
      let cc = c;
      while (cc >= 0 && row[cc]) {
        length += 1;
        cc -= 1;
      }
      info.set(c, length);
    }
  }
  return info;
}

// Down-starts for `row` given its up/down neighbor rows (null = out of bounds = boundary/black).
// Returns Set<col>.
function downStartsForRow(row, upRow, downRow) {
  const size = row.length;
  const cols = new Set();
  for (let c = 0; c < size; c += 1) {
    if (!row[c]) continue;
    const upBlack = !upRow || !upRow[c];
    const downWhite = Boolean(downRow && downRow[c]);
    if (upBlack && downWhite) cols.add(c);
  }
  return cols;
}

// Builds candidate rows cell-by-cell (right to left, matching the numbering scan direction),
// pruning a branch the instant a completed white run's length has no remaining across clue of
// that length - far cheaper than enumerating all 2^size masks and filtering afterwards.
function* freeRowCandidates(size, acrossRemaining) {
  const row = new Array(size);

  function* rec(col, currentRun, remaining) {
    if (col < 0) {
      if (currentRun >= 2 && (remaining.get(currentRun) || 0) <= 0) return;
      yield row.slice();
      return;
    }

    row[col] = true;
    yield* rec(col - 1, currentRun + 1, remaining);

    row[col] = false;
    if (currentRun >= 2) {
      const avail = remaining.get(currentRun) || 0;
      if (avail > 0) {
        const next = new Map(remaining);
        next.set(currentRun, avail - 1);
        yield* rec(col - 1, 0, next);
      }
      // else: placing black here would terminate a run of a length we have none left of - prune.
    } else {
      yield* rec(col - 1, 0, remaining);
    }
  }

  yield* rec(size - 1, 0, acrossRemaining);
}

// Palindrome rows (row[c] === row[size-1-c]) for the self-symmetric middle row of an odd grid.
function* palindromeRowCandidates(size) {
  const half = Math.ceil(size / 2);
  const total = 1 << half;
  for (let mask = 0; mask < total; mask += 1) {
    const row = new Array(size);
    for (let c = 0; c < half; c += 1) {
      const bit = Boolean(mask & (1 << c));
      row[c] = bit;
      row[size - 1 - c] = bit;
    }
    yield row;
  }
}

// Finalizes clue numbering for `row` (already fully known, incl. its across-starts) once its
// down-neighbor row is also known. Validates against `clueLengths` in strict scan order
// (columns size-1 downto 0) and returns the updated counter/assigned-number map, or null on
// mismatch. `clueLengths` is Map<number, { across?: number, down?: number }>.
function finalizeRow({ acrossInfo, downCols, counter, clueLengths, maxNum }) {
  const assigned = new Map();
  let nextCounter = counter;
  const cols = new Set([...acrossInfo.keys(), ...downCols]);
  const sortedCols = [...cols].sort((a, b) => b - a); // scan order: right to left

  for (const c of sortedCols) {
    const isAcross = acrossInfo.has(c);
    const isDown = downCols.has(c);
    nextCounter += 1;
    if (nextCounter > maxNum) return null;

    const expected = clueLengths.get(nextCounter);
    if (!expected) return null;

    if (isAcross) {
      if (expected.across !== acrossInfo.get(c)) return null;
    } else if (expected.across !== undefined) {
      return null;
    }

    if (isDown) {
      if (expected.down === undefined) return null;
    } else if (expected.down !== undefined) {
      return null;
    }

    assigned.set(c, {
      number: nextCounter,
      isAcross,
      isDown,
      acrossLength: isAcross ? acrossInfo.get(c) : null,
    });
  }

  return { counter: nextCounter, assigned };
}

// A necessary (not sufficient) prune: a candidate row can only be viable if the puzzle still
// has enough not-yet-consumed across clues of each length it would introduce.
function affordable(acrossRemaining, acrossInfo) {
  const need = new Map();
  for (const length of acrossInfo.values())
    need.set(length, (need.get(length) || 0) + 1);
  for (const [length, count] of need) {
    if ((acrossRemaining.get(length) || 0) < count) return false;
  }
  return true;
}

function consumeAcross(acrossRemaining, assigned) {
  const next = new Map(acrossRemaining);
  for (const entry of assigned.values()) {
    if (!entry.isAcross) continue;
    const remaining = (next.get(entry.acrossLength) || 0) - 1;
    if (remaining < 0) return null;
    next.set(entry.acrossLength, remaining);
  }
  return next;
}

// Advances the in-progress down-words tracker one row at a time (a word's full length isn't
// known until the row after it ends, so this must be threaded across the whole search).
function advanceActiveDown({ activeDown, row, newStartCols, clueLengths }) {
  const next = new Map(activeDown);
  for (let c = 0; c < row.length; c += 1) {
    if (next.has(c)) {
      const entry = next.get(c);
      if (row[c]) {
        next.set(c, { ...entry, length: entry.length + 1 });
      } else {
        const expected = clueLengths.get(entry.number);
        if (!expected || expected.down !== entry.length) return null;
        next.delete(c);
      }
    } else if (newStartCols && newStartCols.has(c)) {
      next.set(c, { number: newStartCols.get(c), length: 1 });
    }
  }
  return next;
}

// Closes out any down-words still open at the last row, treating the row after the grid as
// boundary/black (so an in-progress word ends exactly at the grid edge).
function closeActiveDown(activeDown, clueLengths) {
  for (const entry of activeDown.values()) {
    const expected = clueLengths.get(entry.number);
    if (!expected || expected.down !== entry.length) return false;
  }
  return true;
}

const DEFAULT_NODE_BUDGET = 3_000_000;

function buildAcrossRemaining(clueLengths) {
  const remaining = new Map();
  for (const dirs of clueLengths.values()) {
    if (dirs.across === undefined) continue;
    remaining.set(dirs.across, (remaining.get(dirs.across) || 0) + 1);
  }
  return remaining;
}

function trySolveSize(clueLengths, maxNum, size, nodeBudget) {
  const budget = { count: 0, limit: nodeBudget };
  const initialAcrossRemaining = buildAcrossRemaining(clueLengths);

  function dfs(r, rows, acrossInfos, activeDown, counter, acrossRemaining) {
    budget.count += 1;
    if (budget.count > budget.limit) return "TIMEOUT";

    if (r === size) {
      return counter === maxNum && activeDown.size === 0
        ? rows.map((row) => row.map((white) => (white ? "." : "#")).join(""))
        : null;
    }

    const mirrorIndex = size - 1 - r;
    let candidates;
    if (r > mirrorIndex) candidates = [reverseArr(rows[mirrorIndex])];
    else if (r === mirrorIndex) candidates = palindromeRowCandidates(size);
    else candidates = freeRowCandidates(size, acrossRemaining);

    for (const rowArr of candidates) {
      const rowAcrossInfo = acrossInfoForRow(rowArr);
      if (r <= mirrorIndex && !affordable(acrossRemaining, rowAcrossInfo))
        continue;

      const newRows = rows.slice();
      newRows[r] = rowArr;
      const newAcrossInfos = acrossInfos.slice();
      newAcrossInfos[r] = rowAcrossInfo;

      let newActiveDown = activeDown;
      let newCounter = counter;
      let newAcrossRemaining = acrossRemaining;
      let ok = true;

      if (r > 0) {
        const upRow = r - 2 >= 0 ? newRows[r - 2] : null;
        const downCols = downStartsForRow(newRows[r - 1], upRow, rowArr);
        const result = finalizeRow({
          acrossInfo: newAcrossInfos[r - 1],
          downCols,
          counter: newCounter,
          clueLengths,
          maxNum,
        });
        if (!result) ok = false;
        else {
          newCounter = result.counter;
          const consumed = consumeAcross(newAcrossRemaining, result.assigned);
          if (!consumed) {
            ok = false;
          } else {
            newAcrossRemaining = consumed;
            const newStartCols = new Map();
            for (const [c, entry] of result.assigned) {
              if (entry.isDown) newStartCols.set(c, entry.number);
            }
            const advanced = advanceActiveDown({
              activeDown: newActiveDown,
              row: newRows[r - 1],
              newStartCols,
              clueLengths,
            });
            if (!advanced) ok = false;
            else newActiveDown = advanced;
          }
        }
      }

      if (ok && r === size - 1) {
        const upRow = r - 1 >= 0 ? newRows[r - 1] : null;
        const downCols = downStartsForRow(newRows[r], upRow, null); // always empty (no boundary continuation)
        const result = finalizeRow({
          acrossInfo: newAcrossInfos[r],
          downCols,
          counter: newCounter,
          clueLengths,
          maxNum,
        });
        if (!result) ok = false;
        else {
          newCounter = result.counter;
          const consumed = consumeAcross(newAcrossRemaining, result.assigned);
          if (!consumed) {
            ok = false;
          } else {
            newAcrossRemaining = consumed;
            const advanced = advanceActiveDown({
              activeDown: newActiveDown,
              row: newRows[r],
              newStartCols: null,
              clueLengths,
            });
            if (!advanced || !closeActiveDown(advanced, clueLengths))
              ok = false;
            else newActiveDown = new Map();
          }
        }
      }

      if (!ok) continue;

      const result = dfs(
        r + 1,
        newRows,
        newAcrossInfos,
        newActiveDown,
        newCounter,
        newAcrossRemaining,
      );
      if (result === "TIMEOUT") return "TIMEOUT";
      if (result) return result;
    }

    return null;
  }

  const result = dfs(0, [], [], new Map(), 0, initialAcrossRemaining);
  return result === "TIMEOUT" ? null : result;
}

// clueLengths: Map<number, { across?: number, down?: number }>
function solveLayout(clueLengths, options = {}) {
  const minSize = options.minSize ?? 11;
  const maxSize = options.maxSize ?? 21;
  const nodeBudgetPerSize = options.nodeBudgetPerSize ?? DEFAULT_NODE_BUDGET;
  const maxNum = Math.max(...clueLengths.keys());

  for (let size = minSize; size <= maxSize; size += 2) {
    const board = trySolveSize(clueLengths, maxNum, size, nodeBudgetPerSize);
    if (board) return board;
  }
  return null;
}

// Converts a scraped answer-key object ({ "5:מאוזן": "מגמתי", ... }) into the
// Map<number, { across?, down? }> shape solveLayout expects.
function clueLengthsFromEntries(entries) {
  const clueLengths = new Map();
  for (const [clueKey, text] of Object.entries(entries)) {
    const [numberStr, direction] = clueKey.split(":");
    const number = Number(numberStr);
    const dirKey = direction === "מאוזן" ? "across" : "down";
    const current = clueLengths.get(number) || {};
    current[dirKey] = text.length;
    clueLengths.set(number, current);
  }
  return clueLengths;
}

module.exports = { solveLayout, clueLengthsFromEntries };
