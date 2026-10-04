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


### E14 — Two different browsers (built-in pane + the user's Chrome), end-of-turn side effects
- **Setup:** Chrome = host ("Baraky"), built-in pane = guest ("Player-5414"). Chrome has no game loaded: open `https://tcg-arena.fr/load/<base64(encodeURIComponent(gamefile URL))>`, wait ~6 s, click *Add game*, then go to Play **inside the app** (a full reload forgets the game). Adding failed to save to the account with `updateDoc … undefined` because the engine copies `menuBackgroundImage` (docs say optional) → added it to `gamefile.json`.
- **End turn (space bar) can have side effects:** the Reserva's `onNewTurn` runs on every client at every turn change (`endOfTurnCleanup()` clears Roxo…Ouro; Hegemonia is kept). Manual §10.3: unstored resources are discarded at the end of your own turn.
  - `game.turn.isMyTurn` inside `onNewTurn` was **not** reliable with my first (flag-based) version: the cleanup ran at the start of each player's *next* turn. At game start the starter sees `true` (current turn). The code now uses `isMyTurn` directly and logs a TEMP `[turn] count=… justEndedWasMine=…` line per client — **verify on the next match whether `true` means "my turn just ended" at a pass, then remove the TEMP line.**
- **Engine untaps every own card at the start of your turn** unless the section has `keepTappedNewTurn` (manual §12.1: Melhorias untap only in the Renovação) → `Território.keepTappedNewTurn: true`. New per-player button *Renovação (minha parte)*: untaps the Território, brings the hand to 6 (reshuffles the Descanso only when you must draw from an empty Império).
- **Combatente buy:** `actionData.position: "BOTTOM"` is ignored for the native Deck (card went on top). The engine uses Shift: click = top (compra plena), Shift+click = bottom (normal buy). `position` removed so the log stays truthful; `tokenForbiddenSections`/`ownerOnlySections` `Deck: false`.
- **Renovação bug found:** *Avançar Mercado* discarded the rightmost = newest card (refills are appended on the right). Now discards the leftmost (oldest). The manual's conveyor runs the other way (newest left); ours is mirrored.
- **Harness quirks (built-in pane):** counters (`input-number`) only commit from real input: type + Enter (wait ~2 s between counters) or hover the *input*, then click ▲/▼ (arrows are hit-testable only while the input is hovered). Synthetic JS clicks work on `<button>`s but not on cards; the `key space` tool does not end the turn in the built-in pane, a synthetic `keydown` on `document.body` does (real space works in Chrome). Overlapped market cards: hover resolves the topmost card, so aim at the left edge. Right-click menus need a hover before their submenu opens. Hotkeys exist (a stray key opened the "look at top of deck" panel).
- **Not finished:** a full game was not completed (only turn 1 of each player was played, in two matches). UX gap: every worker needs a manual counter edit; consider auto-adding 1 resource of the worker's colour when a Trabalhador enters the Descanso.

### E15 — "Look at the top card of the Império" (many cards and the Capitals need it)
- **What the engine offers natively** (from the bundle's translations/menu code): the Deck pile's right-click menu has *Top card visible by…* (everyone / no one / only you / per player, plus "keep on deck change"), *Manage top cards* ("Look and manage the top of your deck": *Show one more*, *Reveal new cards* toggle, *All randomly at bottom*), *Search*, *Shuffle*, *Give top hidden* and *Draw X*. Scripts cannot open these panels.
- **What I saw live (solo, 1280×800):**
  - The `Império` box in our layout (left of the Reserva) opens a reduced menu (*Manage top cards / Search / Shuffle*), but the *Manage top cards* panel there receives an **empty deck** (`Cards shown: 0/0`, "You are not looking at any card yet") even with 6 cards in the Império. Same 0/0 seen in the 2-player match. So that route does not work today.
  - The engine's real deck pile (`.deck-pile`, holds the 6 cards) is drawn at the **bottom-right of the player's board, underneath the Hand**, partly below the viewport (rect ≈ 521,455 54×75 in the 800×500 frame). Right-clicking the visible part did not open a menu (it is covered by the Hand). Its full menu (with *Top card visible by…*) was therefore not reached.
- **Script-side alternative (not built yet):** `functions.getDeck()` already returns the own deck (top = last index, card data readable). A small custom section with `playerRenderOnly: true` (rendered only for its owner, not mirrored to the opponent) could show the top card's image/name and offer buttons: *Olhar topo*, *Revelar* (chatLog), *Pegar para a mão* (`functions.draw(1)`), *Colocar no fundo*. Moving a card to the bottom of the deck is not scriptable (only Shift-drag natively).

### E16 — A full round (2 Campanhas, 2 browsers) with automatic Trabalhar
- **Automatic Trabalhar works:** `Descanso.events.onCardsEnter → trabalhar()` reads `transitionCards` (cards as they were *before* moving, so `position.section === "Hand"` identifies a worker played from the hand) and adds 1 resource of its colour to `game.data.Reserva`. 17 workers played, counters correct every time (e.g. Roxo 1, Vermelho 1, Azul 2, Verde 2). Comerciar (2 workers → 1 Ouro) is still manual.
- **Turn flow verified (12 turn changes):** inside `onNewTurn`, `game.turn.isMyTurn === true` means *my turn just ended* (`count` also lags by one). `endOfTurnCleanup()` therefore fires exactly when you pass and only for the player who passed; e.g. "Fim do turno: reserva descartada (1 roxo, 2 azul)". Off-turn gains are untouched.
- **Melhoria stays tapped across turns** (`Território.keepTappedNewTurn`) and is untapped by *Renovação (minha parte)*.
- **Trégua → Renovação:** both players' button: Melhorias untapped, hand back to 6 (`drew 6`), reshuffle only when the Império ran out ("Império esgotado: Descanso embaralhado…": 1 card + 11 shuffled → hand 6, deck 6, Descanso 0). *Avançar Mercado* now discards the oldest (leftmost) card per row: 4/4/4, discards 1/1/1, piles −1.
- **Bugs found:**
  1. **Market tokens that enter the Império vanish when drawn.** A bought Combatente (token) was lost at the next Renovação, twice (once for each player; the second time the 5 workers drawn afterwards were lost too). Fix: Combatentes shortcut → Mão, then `Hand.onCardsEnter → comprarCombatente()` sends the token to the Desterro and creates a **real** card in the Descanso (`createCard` into `"Deck"` only makes a board card, not a draw-pile card). Verified solo: token in Desterro, real card in Descanso (`descanso=1`), hand untouched. The card now joins the Império at the next reshuffle instead of the bottom; a *compra plena* (top) is a manual move (right-click › To Império › Top).
  2. A card bought by the player who did **not** create the Mercado (tokens belong to `initialBoardSetup` player "0") showed up in the *creator's* deck on the other screen. Not investigated further because of fix 1.
  3. Território cards: the default *link* button covers most of a small card, so a click meant to tap started "Choose the target…". `Território.cardActionShortcut: {action:"NONE"}` now removes it. (To tap a card: hover it and click the "Tap" label, below the old link button.)
  4. Overlapped market cards: a click aimed at one card's shortcut can land on its neighbour and **tap** it (a tapped market card stays tapped). Scripted `button.click()` on the card's `.link-button` avoids it.
- **Harness:** the space bar is flaky (needs `window.focus()` and the key event on both `window` and `document`); counters need real clicks (hover the input, then ▲/▼).

### E17 — Purchase modal (Compra plena / normal / Cancelar)
- **Modal in a script-only game:** a custom section (`Compra`, `playerRenderOnly: true` so the opponent never sees it, `defaultValue` carries the pending card) whose blueprint root is shown with `display: {{ game.data.Compra.open ? 'flex' : 'none' }}`. `Hand.onCardsEnter → comprarCarta()` opens it when a card arrives from a Mercado row; its buttons call `concluirCompra('plena'|'normal')` / `cancelarCompra()`.
- **Positioning gotcha:** `position: fixed` inside a custom section is relative to the player's board container (it has a CSS transform), not the screen; it also draws under the Hand and the shared Mercado. Anchored with `bottom: 31vh` (+ `left: 50%`) so it sits in the free band between the Mercado and the board.
- **`createCard` facts (read from the bundle):** it creates a *real* card (`startOwner = owner = "UNOWNED"`), puts it straight into the named section, fires **no** `onCardsEnter`, and a script can only `moveCard` cards present in its `cards` snapshot, which is not refreshed inside the same script. Hence the plena move to the top of the Império (`subirParaTopo`) runs from the Reserva's `onCardsUpdate` with a flag in `game.data.Compra.topo`. Creating a card in `"Deck"` only makes a board card, not a draw-pile card.
- **Cancel (superseded by E22):** moving a card *into a pile* from a script does nothing; moving it to the Mercado discard works. The first version sent the already-refilled newest card to the discard; E22 holds the refill instead.
- **Verified (solo):** modal opens mid-screen; *Compra plena* → "sent a card to the top of their deck", `deck=7(TTTTTTC)`, token in Desterro; *Cancelar* → hand 7→6, row back to 4. Not yet re-run in a 2-player match.

### E18 — Purchased cards become normal cards (`updateCards`), not `createCard`
- **Why E16/E17's `createCard` was dropped:** cards made by `createCard` are `startOwner = "UNOWNED"`. After a trip through the Império the *other* player could not see them (guest never saw the host's bought Combatente on the Campo), `createCard` into `"Deck"` is only a board card, it fires no `onCardsEnter`, and a just-created card cannot be moved in the same script (stale snapshot).
- **What works:** the Mercado cards are *tokens* (`isToken`, created by `initialBoardSetup`). `functions.updateCards([token], { isToken: false, startOwner: token.owner })` turns the bought token into a normal card of the buyer in place; it then survives draws, is visible to both players and `moveCard` works (plena Combatente → `"Deck"` = top of the Império; normal → `"Discard"`).
- **Verified (2 browsers):** both players bought a Combatente as *plena* via the modal, drew it in the next Renovação, played it to the Campo and the opponent saw it. `autoPlayFromHand`: Combatente → Campo de Batalha, Estratégia → Stack (resolve, then Descanso), Melhoria/Capital → Território, Trabalhador → Descanso.

### E19 — Conflicts (Assalto and Batalha Campal) and who may move what
- **Assalto (manual §14.2), vs a Melhoria:** Baraky's Hastatus + Caetratus (force 2) against P2's Quartel Militar (defence 1) = damage 1 → *saqueada e descartada*. Executed by hand: P2 right-clicks its own Melhoria › *To Descanso › Top*. Result: Melhoria in P2's Descanso, **no Hegemonia** change, no spurious *Trabalhar* (the `trabalhar()` guard only counts workers that come from the Mão), both screens agree. After the Conflito the attacker's Combatentes go to *their* Descanso (same menu, no side effects).
- **Cross-player moves are impossible:** right-clicking an *opponent's* card only offers **Duplicate**, and a drag onto the opponent's Descanso does nothing. So looting / discarding / destroying a Melhoria after an Assalto (and the stored resources it hands to the attacker, the colonist's fate, §14.2) has to be done by the **owner** on request. Nothing in the game state forces it.
- **Batalha Campal (round 2):** Lanceiro Celtibero 2 (after the Hastatus REAÇÃO) vs Hastatus 1: difference 1 → the attacker's Hegemonia 0 → 1 (manual counter), loser's cards to the Descanso. Hide/reveal (face-down on the Campo) works and the opponent sees the face-down card.
- **Harness:** the Chrome tool *does* open right-click menus (sometimes it needs a second try); the menu for an own card shows the Descanso/Império submenus twice (layout row and Hand-aligned piles). Opponent's layout-row Descanso with exactly one card shows the label "undefined" instead of "1" in the other player's view (cosmetic, gone once it holds more cards).

### E20 — Full-game audit, Campanhas 1–3 (two browsers), plus Final de Campanha
Checks after every Campanha: hands = 6, Descanso/Império counts consistent (cards seen = cards owned), Mercado total (piles + rows + discards) = 204 − purchased cards (199 after C2, 196 after C3), both views agree, no console errors from game code (the only `J.target.blur` errors come from the harness' synthetic key events).
- **C1–C3 OK:** trégua by two consecutive passes, `endOfTurnCleanup` on every pass (Hegemonia untouched), Renovação (untap, hand 6, reshuffle only on an empty Império: a real Caetratus bought in C2 came back in P1's next hand), Mercado roll (oldest = leftmost goes to the discard, rows refill 4/4/4, piles −1 each).
- **Gaps found (not bugs of the scripts, rules the game does not enforce):**
  1. *Payment:* buying never deducts the Reserva counters (the modal only records the choice); the unspent counters are discarded at the pass, so a careless player "pays" nothing. The costs and colours are known to the script; a payment step in the modal is the natural next feature.
  2. *Primazia:* the engine does not alternate the first player. After the trégua the turn goes to whoever did not pass last; the player without primazia has to pass once to hand it over (as done in C2). The +1 surcharge on the newest Mercado column for the first player is not tracked either.
  3. *Turn counter:* "Turn N" counts passes, not Campanhas (C3 started at "Turn 6", C4 at "Turn 8").
  4. *Final de Campanha (manual §15.3) was missing*: Hegemonia was a manual counter and the influence points (3/5/7 Melhorias of a civilization = 1/2/3, four colours = 1, Influência Total) were nowhere.
- **Final de Campanha (new):** *Final de Campanha (minha pontuação)* in the Reserva panel → `finalDeCampanha()`: counts the civilization of every card on the Território (Capital counts, neutral Melhorias count for none, manual §12.3), adds the points to Hegemonia, remembers each civilization that reached 3 in `Reserva.marcas` (shown as "Influências: …"; four = *Influência Total*, immediate win; 12+ Hegemonia is announced too) and queues the bonuses, which *Renovação (minha parte)* applies: Fenícia +1 ouro, Helênica hand of 7; Latina (muralha/ficha) and Celta (destroy a card) are announced in the chat, and the political bonus is a reminder (the player chooses). Guarded against double scoring (`Reserva.pontuado`, reset by the Renovação). The scoring function is pure (`influenceScore`) and was unit-tested with mocked globals: 3→1, 5→2, 7→3, 5+3→3, one of each colour→1, repeat guard, Influência Total, 12 points.

### E21 — A fresh match with the new scripts (Helênica host vs Fenícia guest): Final de Campanha live, 5 Campanhas
- **Setup gotchas:** a *running room keeps the config it was created with* (a reconnected guest still showed the old Reserva panel); new scripts/gamefile need a new room. The game stays in the account, so `https://tcg-arena.fr/load/<base64>` only answers "You already have this game" and the next page load already uses the refreshed file (do `fetch(url, {cache:'reload'})` first). In Chrome, a page with a pending "Leave site?" dialog cannot be navigated, reloaded or closed by the tool (`tabs_close` timed out): open a new tab, leave the room as spectator (the old tab still owns the seat), and Ignore the *Reconnect* prompt to get a fresh lobby. Lobby: *Direct connect* → the host's id (`span.real`) typed into the guest's "enter their id" field → ▶ Start → each player picks a precon (the guest got Fenícia; the dice button re-rolls).
- **Final de Campanha, live (all four paths):** the civilization is read from `card.cardData.civilization` (it works for the Capital and for converted market cards).
  - C1: Helênica 2 / Fenícia 1 + Celta 1 → +0. C2: Helênica 3 (Pella, Templo de Zeus, Templo de Hermes) → **+1**, "Influências: Helênica", bonus queued. C3: guest Fenícia 3 → +1, host Helênica 3 again → +1 (scored every Campanha). C4: host Fenícia 1 + Latina 1 + Helênica 3 + Celta 1 → **+1 (civilização) +1 (política)** = 4; political-bonus reminder in the chat.
  - Both screens show the same Hegemonia right after the button (no lag when set by script).
  - **Renovação bonuses:** Helênica → "drew 7" (`Bônus Helênica: 1 carta a mais na mão (7)`, with the reshuffle when the Império ran out); Fenícia → `Ouro` counter 0 → 1, which survives until the end of the owner's next turn (the end-of-turn cleanup only runs for the player who passes).
  - **12 points:** with Hegemonia set by hand to 10, the next Final de Campanha added +2 and logged "Hegemonia 12 (12 ou mais): vitória!". The engine itself keeps running (nothing ends the match).
- **Manual counter edits (`input-number`) commit on blur, not on Enter:** typing 10 + Enter changed only the local box; after clicking elsewhere the value reached the other player and "Hegemonia agora: 10" was logged. This explains the earlier "one change late"/missing log. Script-set values are immediate.
- **Primazia by pass order:** with the starter chosen at random (guest), alternating the first player of each Campanha needed the last trégua pass to come from the *other* player (3 or 4 passes after the last action). Worked every time (guest, host, guest, host, guest) but it is a manual agreement.
- **Audit per Campanha (hands 6/7, Mercado total = 204 − purchased cards: 202, 199, 195, 193; rows 4/4/4, discards +1 each, no console errors in either browser):** all green. The plena Combatente paid with gold (Lanceiro Celtibero) went to the top of the Império and was drawn in the next Renovação.
- **Chrome harness:** a Chrome tab that is not the visible one does not render its hand until a screenshot is taken (the DOM reads `hand: []` until then); synthetic `keydown`/`keyup` on `document.body` passes the turn in both browsers (on `document`/`window` it throws `J.target.blur is not a function`).

### E22 — "Look at the top card" panel and a proper Cancel for purchases
- **Topo panel (answers E15):** custom section `Topo` (`playerRenderOnly`, shown only to its owner). *Olhar topo do Império* → `olharTopo()` reads `functions.getDeck()` (last index = top), takes the face with `getCardData` (name, image) plus `card.cardData` (civilization, ability text) and fills `game.data.Topo`; buttons: *Mostrar aos outros* (chat line), *Pegar para a mão* (`draw(1)`), *Deixar no topo*. The guest never sees the host's panel. Live: image/name/text/size correct, hand 6 → 7 after taking.
  - **Layout gotcha:** the shared Mercado draws *above* a modal and the player's own Capital/Hand draw above it too, so it has to fit in the free band between them (`bottom: 33vh`, ~16vh tall, image 14vh). A taller version ran under the Mercado cards.
- **Cancel, three bugs found by the user:** (1) the refill happened as soon as the card was bought, so on cancel the refilled card had to be discarded; (2) the returned token went to the *end* of the row; (3) found while testing: the returned token stayed **owned by the buyer**, so the other player got no buy button on it (and a market card owned by someone is not a shared token any more).
  - **Fix 1:** `comprarCarta` sets a *shared* flag (`MercadoEstado.pendente`, a custom section with `isShared: true`, written by the buyer even when it is the guest); the host's `keepMarketFull` waits 700 ms (the flag is set ~300 ms after the move, the event runs ~500 ms after it) and does not refill while it is set. `concluirCompra` clears it *before* its card changes, which trigger the refill; `cancelarCompra` clears it after returning the card.
  - **Fix 2:** the full original `position` of the card is stored at purchase time (from `transitionCards`, which holds the card *before* the move). On cancel: `moveCard` back to the row, then `updateCards([token], { position: { ...original, index: original.index - 0.5 } })` and `repositionCards()`. `updateCards` is `Object.assign` by card id (the engine's implementation), so the stale snapshot of the token is enough and no fresh snapshot is needed; an index just before the old neighbour sorts correctly whether or not the other cards were renumbered. A first version that waited for the next `onCardsUpdate` for a fresh snapshot restored the slot only after unrelated card changes.
  - **Fix 3:** `functions.giveCardTo(token, "UNOWNED")` right after the move.
  - **Verified live (2 browsers, both as buyer):** row 3 cards and pile unchanged while the modal is open; after Cancel the card is back in its slot (index and x position), owner `UNOWNED`, shortcut button present for both players, Mercado discard untouched; the other player then bought the cancelled card (normal) and the row refilled to 4 (pile −1).
- **Script reload:** a reconnected guest ran the *new* `game-scripts.js` after a page reload (cache refreshed first), while the room kept the *old* gamefile (layout, events). So script-only changes can be iterated by reloading + *Reconnect*; gamefile changes need a new room, **and the host's page must be fully reloaded (not just leave the room) before creating it**, otherwise the room is built from the host's in-memory old file.

*(next entries: Fuga e Perseguição, Formações, a payment step in the Compra modal.)*
