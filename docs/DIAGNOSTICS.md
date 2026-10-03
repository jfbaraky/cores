# Diagnostics log

How we debug the game on TCG Arena, and what each experiment showed. Newest findings at the bottom.
Companion to [TCGA-REFERENCE.md](TCGA-REFERENCE.md) (what the platform offers) — this file is *what we observed*.

## 1. Built-in diagnostics (in the repo)

| Tool | Where | What it does |
|---|---|---|
| `[debug <tag>]` log line | `debugBoard(tag)` in `game-scripts.js`, run by the DEBUG button | Writes one chat/log line: counts of Hand/Deck/Território/Descanso and of every Mercado row/discard **as the script sandbox sees them**, plus card-type initials (`T`=Trabalhador, `C`=Capital/Combatente…). |
| **DEBUG** button | Last button of the Reserva panel (`gamefile.json`) | Runs `debugBoard('button')` on demand, so the sandbox's view can be sampled at any moment of a match. |
| Timeline poller | Snippet below (paste in the page console / test harness) | Records every change of "how many cards sit in each section" with a millisecond timestamp, tagging the Capital. Shows the *UI* state over time, to compare with what the log claims. |
| React-fiber card probe | Snippet below | Reads the **engine's own card objects** (`section`, `owner`, `startOwner`, `isToken`, `isTapped`) straight from the DOM element's React fiber. This is what exposed the token problem (E11) — the DOM class alone only shows the section. |
| Source inspection | `curl https://tcg-arena.fr/assets/index-*.js` then grep (e.g. `autoPlayFromHand`, `onCardsLeave`) | The app is unminified enough to read how a field is really consumed. Used to settle every docs ambiguity so far. |

Card probe (works in the page console; `g` is any `.game-card` element):
```js
function cardOf(el){ const k = Object.keys(el).find(x => x.startsWith('__reactFiber$')); let f = el[k];
  for (let i=0; f && i<40; i++, f=f.return) { const p = f.memoizedProps; if (p && p.card && p.card.startOwner !== undefined) return p.card; } return null; }
// live format options (merged defaults): same walk, looking for memoizedProps.gameOptions.format.sections
```

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
Remove `debugBoard` and the DEBUG button once play-testing is finished.

## 2. Test-harness recipe and quirks (browser automation)

- **Refresh the HTTP-cached config before every test:** GitHub Pages sends `max-age=600`, and the browser keeps serving an old `gamefile.json`
  for ~10 min. In the page: `await fetch('https://jfbaraky.github.io/cores/gamefile.json', {cache:'reload'})`, **then** reload (navigating first and refreshing
  after leaves the old config in memory — this cost one wasted round). Verify the live config from the fiber (`gameOptions.format.sections`). Wait for the deploy
  from the shell: `curl -s "https://jfbaraky.github.io/cores/gamefile.json?x=$RANDOM" | grep …`.
- Enter the game through the home page → **Play**. Loading `/play` directly renders nothing.
- The Browser pane must be **displayed**: while hidden, renders are blank/slow, screenshots time out and in-page polling stops after 45 s. `preview_start` with a `url` reopens it (new tab id).
- Do not resize the viewport once a match is running (it reloads the page and drops the match). Set it once, before starting.
- Synthetic (JS-dispatched) drag events are ignored by the app, and a real `left_click_drag` from the market to the Hand once crashed the app
  (`Cannot read properties of undefined (reading 'clients')`, later `…'clientX'` in the console); use the click-based shortcuts (`autoPlayFromHand`, `cardActionShortcut`).
- A `cardActionShortcut` button is `visibility:hidden` until its card is hovered: `hover` the card, read the button's rect from the DOM, then click it. Clicking
  the same spot without hovering taps the card instead (that is how the first buy attempt "tapped" a Combatente).
- Match start in the harness: home → Play → ▶ → Start → *Preconstructed decks* → Continue (viewport 1280x800 ⇒ screenshot frame 800x500, scale 0.625).
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

### E8 — `getDeck()` cards cannot be moved
- **Method:** with the Capital in the deck (`deckTypes=CTTTTTT`), `placeCapital()` called `moveCard(capital, "Territorio")` on the object from `getDeck()` (twice, from two triggers).
- **Result:** my own log line printed, but there was **no native "played … to território" line, no state change** (no Capital image anywhere in the UI; hand correctly 6 workers).
  `moveCard` on a `getDeck()` object is a **silent no-op** (the docs say the deck is returned "in read-only mode").
- **Conclusion:** `getDeck()` is for reading only. Don't build placement on it.

### E9 — Native placement of a deck category: `sections.categoriesAlreadyOnBoard`
- **Source:** the deck-loading code in the bundle splits each entry on `->` (`"Capital->Territorio"`); a listed category is **not** put in the deck but placed
  directly in that section (target defaults to the category name when `->` is omitted). The engine's built-in editor schema describes it as
  *"Deck categories that start the game on board. The deck category should match the section in which they are placed"* and lists it, together with
  `autoPlayFromHand`/`autoPlayFromStack`/`customSections`/`layout`/`sectionsDict`, inside `sections`. It is **not in the public docs**.
- **Why it matters:** this is the intended way to start with the Capital in play. It removed the whole Capital script (and `boardCategoriesInSideboard` is not needed).
- **Config:** `"categoriesAlreadyOnBoard": ["Capital->Territorio"]` under `gameplay.Padrao.sections`.
- **Result:** see E10.

### E10 — `categoriesAlreadyOnBoard` works
- **Result (solo, Helênica/Celta/Latina decks):** the Capital sits on Território before the deal, the opening hand is exactly 6 Trabalhadores, the Capital script and
  the `getDeck()` hack are gone, no `placeCapital` race. Hand count 6 on every restart tried (≈8 matches).

### E11 — Buying from the Mercado: log says "returned X to hand", card never leaves the row
- **Symptom:** clicking the corner shortcut (`MOVE → Hand`) printed `returned PRINCEPS to hand`, the card kept `owner = me` but stayed in `MercadoCombatentesRevelado`
  (and the row did not refill). Reproduced 4×, also via right-click → *To Descanso → Top* (`sent X to the top of their discard`, card still in the row).
- **Ruled out (A/B in live matches):**
  1. the `onCardsLeave` refill script reverting the move — same result with the event removed from that row;
  2. `ownerOnlySections` bounce — `Hand: false` confirmed in the live format, same result;
  3. the shortcut itself — `MOVE → Território` (Estratégias) and `MOVE → CampoDeBatalha` (Melhorias) worked, **and the rows refilled to 4**.
- **Cause:** the React-fiber probe showed the Mercado cards have `isToken: true, tokenCount: 1`. Moving a token into a section listed in
  `sections.tokenForbiddenSections` (engine default: Remove, RemoveHidden, Deck, **Hand**, **Discard**, Sideboard) deletes it; the move is logged first, so the log looks successful.
  Exactly the failing destinations (Hand, Descanso) are the forbidden ones.
- **Fix:** `tokenForbiddenSections: {Hand:false, Discard:false, Remove:false, RemoveHidden:false}` and `ownerOnlySections: {Hand:false, Discard:false}`
  (the latter so a guest can take cards whose `startOwner` is the host). After a **proper reload** (see harness note): buy → `returned ESCARAMUÇADOR to hand`,
  Hand 6→7, row back to 4, pile 53→52. Click on the bought token in Hand → `played ESCARAMUÇADOR from hand to território`.

### E12 — Renovação over-filled the Mercado (6/6/6)
- **Symptom:** *Avançar Mercado (Renovação)* moved one card per row to its Descarte, then every row ended with 6 revealed (piles 49/66/67).
- **Cause:** each row that lost a card fires its own `onCardsLeave`; all three called `replenishMarket()` (all rows), each from a snapshot where the other rows were still at 3
  → 3 events × +1 per row.
- **First fix (intermediate):** per-row `onCardsLeave` → `replenishRow(pile, revealed)`. Renovação then gave 4/4/4, discards 1/1/1, piles 52/68/69 (= 53/69/70 − 1 each) in solo.
- **Final design:** see E13 — one self-healing refill (`keepMarketFull`) on the Reserva's `onCardsUpdate`, no per-row events.

### E13 — Two players (host tab + guest tab, same browser pane)
- **Setup:** host opens Play and reads its room id from `span.real`; the guest tab (Play → Direct connect → paste id → Connect) joins; host ▶ → Start; each picks *Preconstructed decks*.
  Both players get the same display name; sides are told apart by `card.position.playerSide`.
- **Layout:** each tab shows its own board at the bottom (Hand fully visible) and the mirrored opponent board on top, the Mercado in between; everything fits 1280×800. The native ◇◇◇ player box sits left of the Hand and overlaps nothing.
- **Ownership:** all Mercado cards were created by player "0" (`initialBoardSetup` key `"0"`) — here the *guest* (`startOwner` = guest, `owner = UNOWNED`, tokens). The host could still shuffle and draw them.
- **Bug seen once:** the first run's Combatentes reveal was logged (`played …` ×4) and then reverted — row empty, pile back at 57 — while Estratégias/Melhorias stayed open; "Repor Mercado" fixed it (row 4, pile 53). Not reproduced in the next run (opened 4/4/4 within 0.5 s of the guest confirming the deck).
  Likely a start-up sync race (the first section touched is overwritten by state still in flight from the creating player). Not proven.
- **Fix/hardening:** the refill now lives in the Reserva's `onCardsUpdate` → `keepMarketFull()` (host only; a no-op until at least one row has cards). That event fires ~500 ms after the *last* card change, so its snapshot is settled and every shortfall is filled exactly once; it also repairs a reverted row by itself. Per-row `onCardsLeave` handlers were removed (they used stale snapshots of the other rows).
- **Verified (2 players):** guest buys a Combatente → guest Hand 6→7, row 3→4, pile 53→52, host sees the same counts; guest presses *Avançar Mercado (Renovação)* → rows 3/3/3 → 4/4/4 within 1 s, discards 1/1/1, piles −1 each.
- **Not yet done:** host-side buy/play in the same match, paying costs with the Reserva counters, a full round.

### Summary of the current playable state (solo, 1280×800)
Capital auto-placed · 6-card hand visible · Mercado auto-opens 4/4/4 · buy → Hand → click → Território works for tokens · worker click → Descanso · Renovação · works with 2 players (guest buy + guest Renovação) · no console errors from game code.
**Not yet tested:** paying costs with the Reserva counters (manual), a full round, host-side buy in a 2-player match.

*(next entries: a full round.)*
