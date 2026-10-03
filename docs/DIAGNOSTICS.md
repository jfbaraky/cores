# Diagnostics log

How we debug the game on TCG Arena, and what each experiment showed. Newest findings at the bottom.
Companion to [TCGA-REFERENCE.md](TCGA-REFERENCE.md) (what the platform offers) — this file is *what we observed*.

## 1. Built-in diagnostics (in the repo)

| Tool | Where | What it does |
|---|---|---|
| `[debug <tag>]` log line | `debugBoard(tag)` in `game-scripts.js`, called at the start of `placeCapital()` | Writes one chat/log line: hand/deck/Território counts **as the script sandbox sees them**, the key names of a card returned by `getDeck()`, and the card-type initials of the deck and hand (`T`=Trabalhador, `C`=Capital/Combatente…). |
| **DEBUG** button | Last button of the Reserva panel (`gamefile.json`) | Runs `debugBoard('button')` on demand, so the sandbox's view can be sampled at any moment of a match. |
| Timeline poller | Snippet below (paste in the page console / test harness) | Records every change of "how many cards sit in each section" with a millisecond timestamp, tagging the Capital. Shows the *UI* state over time, to compare with what the log claims. |
| Source inspection | `curl https://tcg-arena.fr/assets/index-*.js` then grep (e.g. `autoPlayFromHand`, `onCardsLeave`) | The app is unminified enough to read how a field is really consumed. Used to settle every docs ambiguity so far. |

Timeline poller:
```js
window.__tl = []; const t0 = performance.now();
setInterval(() => {
  const c = {};
  document.querySelectorAll('.game-card').forEach(g => {
    const s = (g.className.match(/game-card (\S+)/) || [])[1];           // section the card is in
    const k = s + (g.querySelector('img[src*="capital-"]') ? '[CAP]' : '');
    c[k] = (c[k] || 0) + 1;
  });
  const key = JSON.stringify(c), last = __tl.at(-1);
  if (!last || last.key !== key) __tl.push({ t: Math.round(performance.now() - t0), key });
}, 100);
```
Remove `debugBoard`, its call and the DEBUG button once the Capital flow is stable.

## 2. Test-harness recipe and quirks (browser automation)

- **Refresh the HTTP-cached config before every test:** GitHub Pages sends `max-age=600`, and the browser keeps serving an old `gamefile.json`
  for ~10 min. In the page: `await fetch('https://jfbaraky.github.io/cores/gamefile.json', {cache:'reload'})`, then reload. The `.js` file is
  fetched with a `?_t=` cache-buster by the app and needs nothing.
- Enter the game through the home page → **Play**. Loading `/play` directly renders nothing.
- The first Play render can take 10–60 s in the harness (the pane is often "hidden", which throttles rendering); resources themselves load in
  milliseconds. This is a harness artifact, not a game problem.
- Do not resize the viewport once a match is running (it reloads the page and drops the match). Set it once, before starting.
- Synthetic (JS-dispatched) drag events are ignored by the app; use the click-based shortcuts (`autoPlayFromHand`, `cardActionShortcut`) instead.
- Section of a card in the UI: `document.querySelector('.game-card').className` starts with `game-card <SectionName>`.

## 3. Experiment log

### E1 — `countersStartingValues` removal crashed match start
- **Hypothesis:** the native player-counter widget overlapping the Mercado buttons comes from `countersStartingValues`; removing the field removes it.
- **Method:** removed the field, started a match, read the console.
- **Result:** `Uncaught TypeError: Cannot read properties of undefined (reading 'forEach')` in `setGameOptions`; match stuck at "Turn 0".
  Source: `xe.format.countersStartingValues.forEach(...)` runs unconditionally. Restoring `[]` fixed the crash.
- **Conclusion:** the field is effectively required (docs say optional). It was **not** the cause of the overlap: the ◇◇◇ / player-name box is still there with `[]`.

### E2 — Where `autoPlayFromHand` really lives
- **Hypothesis:** it belongs in `sectionsDict.Hand` (a docs summary said so).
- **Method:** read the raw docs and the engine bundle.
- **Result:** raw docs give it its own "Auto-play destinations" subsection with no parent stated; the engine reads `sections.autoPlayFromHand` (sibling of
  `layout`/`sharedZone`/`sectionsDict`). A missing object makes a hand click throw `reading '<Type>'`; an unmapped type goes to the Stack.
- **Conclusion:** moved to the `sections` level; `Trabalhador → Discard` (clicking a worker = "Trabalhar").

### E3 — Old design: log said "moved", UI said "didn't"
- **Observation:** with the previous draw-everything/trim script, the log showed `drew 7`, `played Avaricum … território`, 3 workers "sent to deck",
  but the DOM showed all 13 cards in Hand and Território empty (reproduced 2×, also after "Restart with the same decks"). A 100 ms timeline showed Deck 13 → Hand 13 in one step.
- **Conclusion:** unresolved root cause; the design was retired (see E6). Consistent with scripts acting on a stale snapshot (E5).

### E4 — Bisecting config variants
- Local server: blocked by the browser pane (`ERR_BLOCKED_BY_CLIENT`). GitHub Pages ignores `_`-prefixed folders (Jekyll). Superseded by the refactor; the temporary variants were removed.

### E5 — Engine facts from the bundle (not in the docs)
- Scripts run in a **Web Worker**: the app posts `REGISTER` (code) and `EXECUTE` messages whose payload carries `game` and `cards` **snapshots** taken when
  the event fires. Hence: no persistent module state, and `cards` can lack cards that were just created/moved.
- Regular-section `events` are read as `onCardsEnter` / `onCardsLeave` (aliases `onCardEnter`/`onCardLeft`), buffered **300 ms**, with the moved cards in `transitionCards`.
- Native autopay only runs for a section with `autoPayFrom` (undocumented); `noAutoPayTo` is irrelevant for us.
- `sections.ownerOnlySections` (undocumented, off by default) can bounce non-owner moves into Hand/Discard/Exile/decks back to the owner.

### E6 — Refactor to native features (this commit series)
- Capital → `functions.getDeck()` + `moveCard`; Market refill → rows' `onCardsLeave`; click-to-play → `sections.autoPlayFromHand`; compact vh layout.
- **Market auto-open at `onPlayersReady` worked**: 4/4/4 revealed ≈1.4 s after the deck was confirmed.

### E7 — What the sandbox sees at the trigger points (`debugBoard`)
- **Result (Latina deck, both `onPlayersDeckPicked` and `onPlayersReady`):** `hand=0 deck=7 terr=0`, deck types all `T`.
  → The opening hand is **already dealt** at both events (13 − 6 = 7 left), yet `cards.Hand` is **empty** in the snapshot; the Capital was in the dealt hand.
- `getDeck()` returns card objects with keys `id, position, hiddenTo, isTapped, isFlipped, counters, notes, owner, cardData, isHorizontal, startOwner`.
- **Conclusion:** the deck path alone is not enough; the hand must be inspected once the dealt cards have landed → `onCardsEnter` on `Hand` (300 ms debounce).

*(next entries: result of the Hand `onCardsEnter` trigger, `getDeck()` + `moveCard` from the deck, Market refill on `onCardsLeave`, layout fit, two-player ownership.)*
