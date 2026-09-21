import re
from z3 import And, Bool, Or, Solver, Not, sat
from PIL import Image, ImageDraw, ImageFont

# הטקסט שהתקבל כקלט
SOLUTIONS_TEXT = """
להצגת כל הפתרונות לחצו כאן
1 מאוזן:נגדהזרמ
5 מאוזן:מגמתי
8 מאוזן:הגדיר
9 מאוזן:ירדמהקו
10 מאוזן:כלהמיומי
12 מאוזן:שפה
14 מאוזן:לאמשהו
15 מאוזן:גרפילד
18 מאוזן:תרש
19 מאוזן:מזרהאימה
21 מאוזן:וישלומר
22 מאוזן:אלבומ
24 מאוזן:המתנה
25 מאוזן:ממריאות
1 מאונך:נלהב
2 מאונך:דוד
3 מאונך:זורקמרה
4 מאונך:מריבות
5 מאונך:מרדני
6 מאונך:מאהושתיימ
7 מאונך:ירומהודו
11 מאונך:לאמהשחשבת
13 מאונך:ללאתמורה
16 מאונך:רואהאור
17 מאונך:מרקרימ
19 מאונך:מבואה
20 מאונך:עמית
23 מאונך:בבא
"""


def parse_solutions(text: str) -> tuple[dict[int, int], dict[int, int]]:
    """מחלץ את מספרי ההגדרות ואורכי המילים מהטקסט."""
    across_words = {}
    down_words = {}

    pattern = re.compile(r"(\d+)\s*(מאוזן|מאונך)\s*:\s*(\S+)")
    for line in text.strip().splitlines():
        match = pattern.search(line)
        if match:
            num = int(match.group(1))
            direction = match.group(2)
            length = len(match.group(3))

            if direction == "מאוזן":
                across_words[num] = length
            else:
                down_words[num] = length

    return across_words, down_words


def solve_crossword_layout(
    across_words: dict[int, int],
    down_words: dict[int, int],
    rows: int = 11,
    cols: int = 11,
):
    """מפענח את מבנה הלוח בעזרת Z3 Solver."""
    solver = Solver()

    # grid[r][c] = True אם המשבצת לבנה, False אם היא שחורה
    grid = [[Bool(f"cell_{r}_{c}") for c in range(cols)] for r in range(rows)]

    def is_white(r, c):
        if 0 <= r < rows and 0 <= c < cols:
            return grid[r][c]
        return False

    def is_black(r, c):
        if 0 <= r < rows and 0 <= c < cols:
            return Not(grid[r][c])
        return True  # מחוץ מגבולות הלוח נחשב כשחור

    # 1. הגדרת התנאים עבור תחילת מילים
    across_starts = {}
    down_starts = {}
    has_clue = {}

    all_nums = sorted(list(set(across_words.keys()) | set(down_words.keys())))
    max_num = max(all_nums)

    for r in range(rows):
        for c in range(cols):
            # תחילת מילה מאוזנת (מימין לשמאל: מימין שחור/גבול, ומשמאלה משבצת לבנה)
            a_start = Bool(f"across_start_{r}_{c}")
            solver.add(
                a_start
                == And(
                    grid[r][c],
                    is_black(r, c + 1),  # מימין שחור/גבול
                    is_white(r, c - 1),  # משמאל לבן
                )
            )
            across_starts[(r, c)] = a_start

            # תחילת מילה מאונכת (מלמעלה למטה: מעל שחור/גבול, ומתחתיה משבצת לבנה)
            d_start = Bool(f"down_start_{r}_{c}")
            solver.add(
                d_start
                == And(
                    grid[r][c],
                    is_black(r - 1, c),  # מעל שחור/גבול
                    is_white(r + 1, c),  # מתחת לבן
                )
            )
            down_starts[(r, c)] = d_start

            # המשבצת מקבלת מספר אם היא תחילת מילה מאוזנת או מאונכת
            hc = Bool(f"has_clue_{r}_{c}")
            solver.add(hc == Or(a_start, d_start))
            has_clue[(r, c)] = hc

    # 2. סימטריה סיבובית של 180 מעלות (נפוץ בתשבצי היגיון)
    for r in range(rows):
        for c in range(cols):
            solver.add(grid[r][c] == grid[rows - 1 - r][cols - 1 - c])

    # 3. מספור המשבצות לפי סדר סריקה (שורה-שורה, מימין לשמאל)
    # count[i][k] == True אם יש לפחות k משבצות ממוספרות בין התאים 0..i (כולל)
    scan_order = [
        (r, c) for r in range(rows) for c in range(cols - 1, -1, -1)
    ]
    n_cells = len(scan_order)

    count = [
        [Bool(f"count_{i}_{k}") for k in range(max_num + 2)]
        for i in range(n_cells)
    ]

    first_r, first_c = scan_order[0]
    hc0 = has_clue[(first_r, first_c)]
    solver.add(count[0][1] == hc0)
    for k in range(2, max_num + 2):
        solver.add(Not(count[0][k]))

    for i in range(1, n_cells):
        hc = has_clue[scan_order[i]]
        solver.add(count[i][1] == Or(count[i - 1][1], hc))
        for k in range(2, max_num + 2):
            solver.add(
                count[i][k] == Or(count[i - 1][k], And(count[i - 1][k - 1], hc))
            )

    # סה"כ מספר המשבצות הממוספרות חייב להיות שווה בדיוק למספר ההגדרה הגבוה ביותר
    solver.add(count[n_cells - 1][max_num])
    solver.add(Not(count[n_cells - 1][max_num + 1]))

    # 4. עבור כל מספר הגדרה, נאתר את המשבצת המתאימה ונאמת אורך/כיוון
    for num in all_nums:
        cell_matches = []
        for i, (r, c) in enumerate(scan_order):
            hc = has_clue[(r, c)]
            if num == 1:
                is_this_num = And(hc, Not(count[i - 1][1])) if i > 0 else hc
            else:
                is_this_num = And(hc, count[i - 1][num - 1], Not(count[i - 1][num]))

            conds = [is_this_num]

            # התאמה להגדרה מאוזנת אם קיימת
            if num in across_words:
                length = across_words[num]
                conds.append(across_starts[(r, c)])
                for step in range(length):
                    conds.append(is_white(r, c - step))
                conds.append(is_black(r, c - length))
            else:
                conds.append(Not(across_starts[(r, c)]))

            # התאמה להגדרה מאונכת אם קיימת
            if num in down_words:
                length = down_words[num]
                conds.append(down_starts[(r, c)])
                for step in range(length):
                    conds.append(is_white(r + step, c))
                conds.append(is_black(r + length, c))
            else:
                conds.append(Not(down_starts[(r, c)]))

            cell_matches.append(And(conds))

        solver.add(Or(cell_matches))

    # 5. פתרון המודל
    if solver.check() == sat:
        model = solver.model()

        # בניית הלוח המפוענח
        board_rows = []
        for r in range(rows):
            row_str = ""
            for c in range(cols):
                is_w = model[grid[r][c]]
                row_str += "." if is_w else "#"
            board_rows.append(row_str)

        return board_rows
    else:
        return None


def generate_numbering(board_rows: list[str]) -> list[list[int | None]]:
    """ממספר את המשבצות לפי סדר סריקה (שורה-שורה, מימין לשמאל)."""
    rows = len(board_rows)
    cols = len(board_rows[0])
    numbering: list[list[int | None]] = [[None] * cols for _ in range(rows)]
    current = 0

    def is_black(r, c):
        return board_rows[r][c] == "#"

    for r in range(rows):
        for c in range(cols - 1, -1, -1):
            if is_black(r, c):
                continue
            across_start = (
                (c == cols - 1 or is_black(r, c + 1))
                and c - 1 >= 0
                and not is_black(r, c - 1)
            )
            down_start = (
                (r == 0 or is_black(r - 1, c))
                and r + 1 < rows
                and not is_black(r + 1, c)
            )
            if across_start or down_start:
                current += 1
                numbering[r][c] = current

    return numbering


def render_board_image(
    board_rows: list[str],
    output_path: str = "board.png",
    cell_size: int = 60,
) -> None:
    """מייצר תמונת PNG של הלוח (משבצות שחורות/לבנות עם מספור) בעזרת Pillow."""
    rows = len(board_rows)
    cols = len(board_rows[0])
    numbering = generate_numbering(board_rows)

    margin = 4
    width = cols * cell_size + margin * 2
    height = rows * cell_size + margin * 2

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    try:
        font = ImageFont.truetype("arial.ttf", size=cell_size // 5)
    except OSError:
        font = ImageFont.load_default()

    for r in range(rows):
        for c in range(cols):
            # מספור המשבצות סורק מימין לשמאל, ועמודה 0 היא הימנית ביותר בלוח
            x0 = margin + c * cell_size
            y0 = margin + r * cell_size
            x1 = x0 + cell_size
            y1 = y0 + cell_size

            is_black = board_rows[r][c] == "#"
            draw.rectangle([x0, y0, x1, y1], fill="black" if is_black else "white", outline="black")

            number = numbering[r][c]
            if number is not None:
                draw.text((x0 + 3, y0 + 1), str(number), fill="black", font=font)

    image.save(output_path)


# --- הרצה ---
across_words, down_words = parse_solutions(SOLUTIONS_TEXT)
board = solve_crossword_layout(across_words, down_words, rows=13, cols=13)

if board:
    print("BOARD_ROWS = [")
    for row in board:
        print(f'    "{row}",')
    print("]")
    render_board_image(board, output_path="board.png")
    print("נשמרה תמונה: board.png")
else:
    print("לא נמצא פתרון המתאים לאילוצים.")