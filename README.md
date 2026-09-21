# Crossword WhatsApp Bot

A WhatsApp bot that runs a daily crossword game inside a WhatsApp group: it posts the puzzle board as an image, grades members' answers in real time, tracks a leaderboard, and automatically locks the game during Shabbat.

## How it works

- **Board source**: any crossword series from [14across.co.il](https://www.14across.co.il/) — not tied to a single fixed series.
- **New board**: post a direct `14across.co.il/answers.php` link, or free text starting with a trigger word (e.g. `לוח תרתי משמע 04/09/2026` or just `תשבץ הפוך על הפוך` for the latest available date). The bot resolves the series name to its id (via a cached directory), scrapes the answer key, reconstructs the grid layout from the clue lengths (no image/OCR needed), and starts tracking that board.
- **Answering**: group members reply with a message like `12 מאוזן - פתרון` (clue number, direction, answer text). The bot grades it against the scraped answer key and reacts with 👍🏻/❌.
- **Scoring**: correct answers earn a point, with a cooldown per user between scored answers to prevent spamming (a one-time reminder is sent per board if a correct answer doesn't score due to the cooldown).
- **Board view**: members can request the current board state with `תראה` or `?`.
- **Ending a board**: `סיום תשבץ` asks for confirmation; replying `כן` auto-fills any unsolved answers, announces the leaderboard, and freezes the board.
- **Shabbat lock**: using `shabbat-times.json`, the bot automatically disables scoring/answers during Shabbat.

## Tech stack

- Node.js (CommonJS)
- [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web client
- `cheerio` — scraping the series directory and answer key pages
- `playwright` — rendering the board image (and a scrape fallback for JS-gated pages)

## Setup

```bash
npm install
npm start
```

On first run, a QR code is printed in the terminal — scan it with WhatsApp (Linked Devices) to log in. Session credentials are saved under `data/auth/` so you only need to do this once.

After logging in, find your target group's JID:

```bash
npm run list-groups
```

Then set it in `src/config.js` (`groupJid`) or via the `CROSSWORD_GROUP_JID` environment variable.

## Useful scripts

| Command                                       | Purpose                                                |
| --------------------------------------------- | ------------------------------------------------------ |
| `npm start`                                   | Run the bot                                            |
| `npm run list-groups`                         | List WhatsApp group JIDs the account belongs to        |
| `npm run test-scrape -- "<url or free text>"` | Test resolving + scraping a board request              |
| `npm run test-board`                          | Test board numbering/model against a sample grid       |
| `npm run test-layout`                         | Test the layout solver against known grids             |
| `npm run test-render`                         | Test the full solve → render pipeline for a real board |

## Configuration

All settings live in [`src/config.js`](src/config.js): group JID, score cooldown, answer/show-board/end-board commands, board trigger words, and data file paths. Game/board state persists to `data/state.json`; the resolved series name→id directory is cached to `data/series-directory.json` (both plain JSON, no database).
