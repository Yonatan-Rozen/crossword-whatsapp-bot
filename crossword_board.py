BOARD_ROWS = [
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
]


def is_black(row: int, col: int) -> bool:
    return BOARD_ROWS[row][col] == "#"


def generate_numbering() -> list[list[int | None]]:
    rows = len(BOARD_ROWS)
    cols = len(BOARD_ROWS[0])
    numbering: list[list[int | None]] = [[None for _ in range(cols)] for _ in range(rows)]
    current = 0

    for row in range(rows):
        for col in range(cols - 1, -1, -1):
            if is_black(row, col):
                continue

            across_start = (
                (col == cols - 1 or is_black(row, col + 1))
                and col - 1 >= 0
                and not is_black(row, col - 1)
            )
            down_start = (
                (row == 0 or is_black(row - 1, col))
                and row + 1 < rows
                and not is_black(row + 1, col)
            )

            if across_start or down_start:
                current += 1
                numbering[row][col] = current

    return numbering


BOARD_NUMBERS = generate_numbering()


def render_board() -> str:
    lines: list[str] = []
    for row_index, row in enumerate(BOARD_ROWS):
        cells: list[str] = []
        for col_index, cell in enumerate(row):
            number = BOARD_NUMBERS[row_index][col_index]
            if cell == "#":
                cells.append("##")
            elif number is None:
                cells.append("..")
            else:
                cells.append(f"{number:02d}")
        lines.append(" ".join(cells))
    return "\n".join(lines)


if __name__ == "__main__":
    print(render_board())