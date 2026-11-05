# Continue: Duolingo Chess

An offline iPhone web app. Import a screenshot of a Duolingo chess board, check what it read, and finish the game against Stockfish. Board reading and the engine both run on the phone, so there is no network access or cloud AI after the first load.

## Use it
1. Open the GitHub Pages URL in **Safari** on the iPhone, then tap Share → **Add to Home Screen**.
2. Open it from the Home Screen once while online. After that it works in Airplane Mode.
3. Tap **Import screenshot** and check the board. Squares the reader wasn't sure about have an amber outline; tap any square to fix it. Then tap **Continue** → **Play**.

Defaults: you play the side at the bottom of the screenshot (White unless the board is flipped). The side to move comes from Duolingo's last-move highlight when there is one, and is Black otherwise. Engine level 5 (~1350), 1 s per move. You can change all of these on the setup screen or under ⚙︎.

## How board reading works
- **Classical computer vision, no ML.** The board is found by scanning rows for the 8-column color flips. Each square's background is measured from its own edge band, so last-move highlights in either theme cancel out. Pieces are matched against templates taken from real screenshots (`src/vision/templates.json`).
- **Learning from fixes.** Corrections you make are saved on the device (IndexedDB) as extra templates.
- **Testing.** `npm test` checks recognition on the screenshots in `fixtures/`, which are kept local and not committed. The tests require an exact match on every square, plus leave-one-out runs, other iPhone resolutions, JPEG compression, Display P3, and a synthetic light-mode highlight.

## Develop
```sh
npm install
npm run dev          # http://localhost:5173  (dev only: ?img=/fixtures/<file> auto-imports)
npm test
npm run templates    # rebuild templates.json from fixtures/*.png + *.fen
npm run build
```

Engine: [Stockfish 19 (stockfish.js lite, single-threaded)](https://github.com/nmrugg/stockfish.js), GPLv3. See `public/engine/COPYING.txt`.
