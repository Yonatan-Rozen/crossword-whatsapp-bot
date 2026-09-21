# Crossword WhatsApp Bot

A WhatsApp bot that runs a daily crossword game inside a WhatsApp group: it posts the puzzle board as an image, grades members' answers in real time, tracks a leaderboard, and automatically locks the game during Shabbat.

## How it works

- **Board source**: puzzles come from [14across.co.il](https://www.14across.co.il/) (a fixed crossword series, only the date changes day to day).
- **New board**: an admin uploads a photo of the day's crossword to the group with a caption containing a trigger word (e.g. "לוח" / "תשבץ"); the bot reads the date from the image (OCR) and renders/tracks that day's grid.
- **Answering**: group members reply with a message like `12 מאוזן - פתרון` (clue number, direction, answer text). The bot grades it against the scraped answer key and reacts with ✅/❌.
- **Scoring**: correct answers earn a point, with a cooldown per user between scored answers to prevent spamming.
- **Board view**: members can request the current board state with the command `תראה`; an admin can end a board early with `סוף התשבץ`.
- **Shabbat lock**: using `shabbat-times.json`, the bot automatically disables scoring/answers during Shabbat.

## Tech stack

- Node.js (CommonJS)
- [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web client
- `cheerio` — scraping the answer key page
- `playwright` — rendering the board image
- `tesseract.js` — OCR to read the puzzle date from uploaded images

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

| Command                             | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `npm start`                         | Run the bot                                     |
| `npm run list-groups`               | List WhatsApp group JIDs the account belongs to |
| `npm run test-scrape -- DD/MM/YYYY` | Test scraping the answer key for a given date   |
| `npm run test-board`                | Test board parsing/model against a sample grid  |
| `npm run test-ocr -- path.jpg`      | Test date OCR on an image file                  |
| `npm run test-render`               | Test rendering the board to HTML/image          |

## Configuration

All settings live in [`src/config.js`](src/config.js): group JID, answer-key source, score cooldown, answer command pattern, board trigger words, and data file paths. Game/board state persists to `data/state.json` (plain JSON, no database).
