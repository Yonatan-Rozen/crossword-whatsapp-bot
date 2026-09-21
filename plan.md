## Plan: WhatsApp Crossword Bot Integration

Turn the existing static crossword board into a WhatsApp-driven workflow where users can add, approve, edit, delete, and inspect crossword words from a group chat. Keep the current board UI as the visual source of truth for the fixed grid, then layer a small backend + WhatsApp webhook on top so the same board state can be updated from simple chat commands.

**Steps**
1. Define the command grammar and message format for the group, including add, approve, edit, delete, show, and help commands. Make the grammar explicit enough that the parser can handle Hebrew text and clue references like "4א" or "19נ" reliably.
2. Extract the crossword board data into a shared model so the HTML view and any bot/backend code use the same fixed grid, numbering, and cell coordinates instead of duplicating the board definition. This should include the current black-cell layout and numbering logic from `crossword_board.html` and `crossword_board.py`.
3. Design the persisted state model for pending words, approved words, edits, deletions, approvals, and audit history. The backend should be able to restore the current board after restart without relying on in-memory state.
4. Implement the command handlers for add/edit/delete/approve/show/help. Additions and edits should create pending changes, approvals should finalize them, deletions should respect overlap rules so letters used by fully different words are protected, and show/help should return a concise board status.
5. Add the approval workflow based on a second person reacting with 👍 or using an explicit approve command if reaction handling is unreliable in the WhatsApp API. Keep the final rule strict: nothing is written to the approved board until another person confirms it.
6. Add rendering/update output for the current board state. Reuse the existing board layout and generate either an updated HTML snapshot, an image export, or a compact status view that can be sent back into WhatsApp.
7. Build the WhatsApp integration layer with webhook handling, message parsing, and outbound replies. This is the transport layer only; it should delegate all crossword logic to the shared model and command handlers.
8. Add permissions and guardrails so only authorized participants can delete or edit approved content, and so every mutation is logged with who requested it, who approved it, and when it happened.
9. Test the full flow end-to-end with a sample group conversation: add a word, approve it, edit it, delete a removable word, reject a deletion that would break overlapping content, and request the current board with a show command.

**Relevant files**
- `crossword_board.html` — current visual board implementation; reuse the board geometry and numbering, but split the data/model out for backend use.
- `crossword_board.py` — current Python mirror of the board; use it as the starting point for shared board data and any future rendering helpers.
- `example.png` — visual reference for the target board style and layout.
- Future backend entrypoint file(s) — will hold WhatsApp webhook, command parsing, persistence, and outbound messaging.
- Future shared model file(s) — will hold the crossword grid, clue numbering, and word-state rules.

**Verification**
1. Run the board renderer locally and confirm the fixed grid still matches the reference image after refactoring.
2. Run parser tests for command variants in Hebrew, including mixed punctuation and RTL input.
3. Simulate add/approve/edit/delete flows against a seeded board state and confirm the stored state matches expectations after restart.
4. Exercise overlap deletion rules with at least one protected word intersection and one removable cell-only change.
5. Perform an end-to-end webhook test with a sandbox or test WhatsApp business number and verify replies for add, approve, delete, show, and help.

**Decisions**
- Keep the crossword grid fixed and treat only the word/content layer as mutable.
- Use a two-step approval process for every new or edited word.
- Prefer a small backend service over embedding logic directly in the HTML file.
- Keep the current board UI as a visual reference, but move the data source to shared code to avoid drift.
- Exclude any advanced search, scoring, or collaborative conflict resolution for now; focus only on the core chat-driven board workflow.

**Further Considerations**
1. Do you want the bot commands to stay in Hebrew only, or support both Hebrew and English aliases?
2. Do you want the approval rule to rely strictly on 👍 reactions, or should an explicit `אשר` command always be available as a fallback?
3. Do you want the bot to post a fresh rendered board image after every approved change, or only when someone asks for `תראה`?
