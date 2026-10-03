# TCG Arena game-file reference (types & methods)

Compact working reference for building *Cores da Guerra* on TCG Arena.
**Source of truth:** the verbatim docs snapshot in [`tcga-snapshot/`](tcga-snapshot/) (fetched 2026-10-03 from
documentation.tcg-arena.fr, converted from HTML, not summarized). When this file and the snapshot disagree, the snapshot wins.
Items marked **[engine]** were verified in the app's own JS bundle or by live testing and are *not* (or not clearly) in the docs.

Type legend: `S` string, `N` number, `B` boolean, `[]` array, `{}` object. R = required, O = optional.

## 1. Where everything lives

```
gamefile.json
├─ name                         S  R
├─ cardRotation                 N  O   (default 45)
├─ customHelp                   S  O   (\n allowed)
├─ translationsUrl              S  O   (single-language games can skip it)
├─ scriptsUrls                  [] O   (URLs of .js files; see §6)
├─ menuBackgroundImage          S  O
├─ defaultRessources            {} O   (sic: "Ressources")
│   ├─ backgrounds              [] O   (playmat images)
│   └─ decksUrl                 S  O   (decks.json)
├─ cards                        {} R
│   ├─ dataUrl                  S  R   (cards.json)
│   ├─ cardBack                 S  R
│   ├─ cardBackColor / extraCardBacks{type:url} / version      O
├─ deckBuilding                 {} R   (§2)
└─ gameplay                     {} R   one key per format; key == deckBuilding.formats[].gameplay
    └─ <Format>
        ├─ defaultNotes, countersStartingValues, hideFacedDownCards, cardRotation   (§3)
        ├─ mulligan, newTurn, teams                                                  (§3)
        ├─ tokens[], draggableTokens[]                                               (§3)
        ├─ beforeGameStart                                                           (§3)
        └─ sections
            ├─ layout                 per-player board tree          (§4)
            ├─ sharedZone             one board zone for everyone    (§4)
            ├─ sectionsDict           behaviour of each section      (§4)
            └─ autoPlayFromHand / autoPlayFromStack   {type: section} **[engine: lives here]** (§4)
```

## 2. `deckBuilding`

| Field | T | | Notes |
|---|---|---|---|
| `mainFilters` | [] | R | Card fields shown under the search bar, e.g. `["type","civilization","cost"]` |
| `costCurveIgnoredTypes` | [] | O | |
| `formats[]` | [] | R | `{ title R, gameplay R, deckRuleset O, customCategories O, legalityCode O }` |
| `deckRulesets` | {} | O | name → `{ checkCardLegality B, general{min,max,maxPerCard}, categories[{category,min,max}] }` |

Rules: `formats[].gameplay` must match a key in `gameplay`; `formats[].deckRuleset` must match a key in `deckRulesets`.
**[engine/live]** a ruleset category matches the card's **`type`** field (a custom field did not work).

## 3. `gameplay.<Format>`

| Field | T | | Notes |
|---|---|---|---|
| `defaultNotes` | S | O | Pre-filled notes panel |
| `countersStartingValues` | [] | O in docs | 0–3 native player counters. **[engine] Required in practice**: `setGameOptions` calls `.forEach` on it unconditionally. Use `[]` for none. Controlled from scripts with `functions.changeCounterValue(index, value)` |
| `hideFacedDownCards` | B | O | Owner can't peek at own face-down cards |
| `cardRotation` | N | O | Per-format override |
| `mulligan.startingHandSize` | N | R | |
| `mulligan.mulliganCount.{min,max}` | N | O | `max: 0` → hand drawn directly, no mulligan panel |
| `mulligan.triggeredByButton / mulliganCycle{info,steps,selectionRange,keepCardsOrder} / postMulligan{...}` | | O | steps ∈ `toBottom toTop draw shuffle applyPenalty` |
| `newTurn.drawOnStart` | B | R | |
| `newTurn.drawPerTurn / sharedTurn / turnOrder / firstPlayerTokenName` | | O | `turnOrder` ∈ `default teamsAlternating teamsSimultaneous`; token name must exist in `tokens[]` |
| `teams.{sharedPlayerCounter,placement,cardsVisibleToTeam}` | | O | Turns a 4-player room into 2v2 |
| **`tokens[]`** | [] | O | **Player-held** tokens (initiative marker). `{ name R unique, image R, isUnique O, leavesAtEndOfTurn O }`. Shown near the player's counter |
| **`draggableTokens[]`** | [] | O | **Card-attached** markers dragged onto a card (unlimited). `{ id R unique, name R, image R }`. Two sibling arrays, **not** nested under `tokens` |
| `beforeGameStart.initialBoardSetup` | []\|{} | O | Array applies to **every player**; object keyed by seat (`{"0":[...]}`) applies per seat. Entry: `{ drawFromTop \| createCardId, count R, destination R, overrideState O, waitForPlayerTurn O }` |
| `beforeGameStart.boardCategoriesInSideboard` | [] | O | **[live] had no effect for a preconstructed deck** (Capital stayed in Deck) |
| `beforeGameStart.boardCardSelection[]` | [] | O | `{ category R, min R, max R, unselectedDestination O }` pre-match pick prompt |
| `beforeGameStart.chooseAnotherStartingPlayer` | B | O | |

## 4. `sections` (board)

### 4.1 `layout` / `sharedZone`
- `layout` node: `{ direction: "row"|"column", content: [nodes], section: "Name", style: {css}, optional: {key: label}, isSymmetricalForOpponents B, reverseForOppositeSide B }`. A leaf is `{ "section": "Name" }`.
- `sharedZone`: `{ height: N (vh) R, layout: tree R }`, rendered once. **Players can only interact with their own cards**, even here.
- Every leaf name must exist in `sectionsDict`. **Names must be a single word, no spaces** (use `displayedTitle` for labels).
- **Custom sections: put them *last* in `layout`** — they are often absolutely positioned, and any section defined after them can render on top and block their clicks.

### 4.2 `sectionsDict[name]` (regular section)
| Field | T | | Notes |
|---|---|---|---|
| `isHidden` | S | R | `no` / `yes` (face-down for all) / `opponent-only` |
| `height` | S\|N | R | `SMALL` `MEDIUM` `DEFAULT` or a number in vh (recommended) |
| `alignment` | S | R | `START CENTER END NONE DECK` (`DECK` = pile; "extra deck" = any `DECK` section) |
| `displayedTitle`, `opponentAlignment`, `heightReference:"horizontal"`, `isHorizontalAllowed`, `noQuickActions`, `isGroupForbidden`, `showHiddenCardInHistory`, `logWhenPlayed`, `cardBackColor` | | O | |
| `enterTapped` | B\|{type:B} | O | |
| `keepTappedNewTurn` | B | O | |
| `noAutoPayTo` | B | O | Only matters with autopay (see §7); we don't use it |
| `cardActionShortcut` | {} | O | One-click corner button (16px, `img[alt="shortcut"]`, **visible only while the card is hovered**; a click on the card without hovering first just taps it): `{ "action":"MOVE", "actionData":{ "destination":"Hand" } }`. `MOVE` calls the same `moveCard` as a drag, so every rule in §4.5 applies |
| `drawDestinations` | {} | O | For `DECK` sections: where a drawn card goes, keyed by type; `_default` for the rest |
| `events` | {} | O | Not in this table in the docs; the scripting page says `onCardsEnter` / `onCardsLeave` can be added to a **regular** section (see §6.3) |

Reserved names (don't reuse for new sections): `Stack Hand Deck Discard Sideboard Remove RemoveHidden`. Special: a section named **`Mana`** shows a count and is the pool for native autopay.
Our display names: `Deck`="Império", `Discard`="Descanso", `Remove`="Desterro", `Hand`="Mão".

### 4.3 Auto-play destinations
`autoPlayFromHand` / `autoPlayFromStack`: `{ "<card type>": "<section>" }`, `"GROUP"` = attach to another card.
Click on a hand card → `autoPlayFromHand[type]`; **[engine] if the object is missing, the click throws `Cannot read properties of undefined (reading '<Type>')`; if the type is unmapped the card goes to the `Stack`.** The docs give no parent object; the engine reads them from the `sections` object (sibling of `layout`).

### 4.4 Custom section (`type: "custom"`)
| Field | T | | Notes |
|---|---|---|---|
| `type` | S | R | `"custom"` (replaces isHidden/height/alignment) |
| `blueprint` | {} | R | UI tree |
| `defaultValue` | {} | O | Initial `game.data.<Section>` |
| `isShared` | B | O | State shared across players instead of per-player |
| `events` | {} | O | See §6.3 |

Blueprint node: `{ type, props, children, onClick, onChange, iterable, template }`. `type` is `button`, `IMG`, `input-number`, `loop`, or any HTML tag.
`{{ expr }}` in strings: read-only, evaluated against `game`, cannot call `functions`. `onClick`/`onChange` run as scripts with `game`, `cards`, `functions`, plus `value`, `delta`, `deltaDisplay` (onChange). Use `functions.chatLog(...)` (bare `chatLog` is not defined in the script sandbox).

### 4.5 Undocumented `sections` keys (read from the engine bundle)
| Key | Notes |
|---|---|
| `categoriesAlreadyOnBoard` | `["Capital->Territorio"]`: deck cards of that category are **not** put in the deck; they start in the named section (target = category name when `->` is omitted). Live-verified; replaces any "find the Capital and play it" script. The opening hand is then dealt from what is left. |
| `ownerOnlySections` | Default `{Deck,Hand,Discard,Sideboard,EXTRADECKS: true}`; entries you give are merged over it. A card moved into such a section by someone who is not its `startOwner` (and the card is not `UNOWNED`) is bounced back to the owner. Set `false` for `Hand`/`Discard` so a guest can take market cards (live: the merged value is applied; the bounce itself was not exercised, solo only). |
| `tokenForbiddenSections` | Default `{Remove,RemoveHidden,Deck,Hand,Discard,Sideboard: true}`, merged the same way. **A token (`isToken: true`) moved into one of these is deleted from the board.** Cards created for a `sharedZone`/extra-deck pile (our Mercado) are tokens, so the Mercado shortcut to `Hand` "worked" (log line, owner set) but the card never left the row until `Hand`/`Discard`/`Remove` were set `false`. |

## 5. Data files
**`cards.json`** — object keyed by card id. Required: `id`, `type`, `cost` (**number**), `face.front{name:{name}, type, cost, image}`, flat `name`. Optional: `face.back`, `isHorizontal`, `isToken`, `tokens[]` (ids creatable by right-click), `_legal{code: B|N}`, any extra field (becomes a deck-builder filter). `cost` may be a mana string like `"{2}{W}"`; `_mana[]` makes a card produce mana. `type` must stay a plain string (can't be translated inline).
**`decks.json`** — array; build in the app: deck builder → *Export → Starter Deck*, paste the result.
**`translations.json`** (optional) — `{ additionalLanguages?:[], en:{ "Card types":{...}, "UI text":{ "translations.customHelp": "..." } }, fr?:{...} }`. `en` required if the file exists. Matching is by literal displayed string; sub-group names are cosmetic. Card fields can also be `{ "en": "...", "fr": "..." }`.

## 6. Scripting

### 6.1 Wiring
`scriptsUrls: ["https://.../game-scripts.js"]`. Functions are declared `async` and called by name from a custom section's `onClick`/`onChange`/`events` (`"await placeCapital()"`). Every script runs in a **sandbox** (errors surface as `Worker Execution Error`). Inside scripts you get three globals: `cards`, `game`, `functions`.

### 6.2 Globals
- `cards.<Section>` — **read-only** arrays for *your own* sections and shared sections; always guard (`cards.Hand ?? []`). Card: `{ id, isTapped, isFlipped, owner ("UNOWNED" = shared), counters[2] }`. **[live]** hidden sections (`isHidden:"yes"`) read as empty — use `getDeck()` for your deck. **[live]** `cards` is not refreshed right after your own `moveCard`.
- `game.data.<Section>` — custom-section state; **mutate directly**. With `isShared:true` it is shared across players.
- `game.isHost` B · `game.turn.{totalPlayers, orderPosition (0-based), count, isMyTurn}`.

### 6.3 Events (custom-section `events`; regular sections only: `onCardsEnter/Leave`)
`onStart` (format picked, deck picker opening) · `onPlayersDeckPicked` · `onPlayersSideboardClosed` · `onPlayersBoardCardSelected` · `onPlayersMulligan` · `onPlayersReady` · `onNewTurn` (**any** player's turn, fires for everyone) · `onUpdate` (own `game.data` changed) · `onOpponentUpdate` (careful: loops) · `onCardsUpdate` (any card change anywhere; debounced) · `onCardsEnter` / `onCardsLeave` (regular section only; moved cards in `transitionCards`).
*(Inferred, not stated in the docs: each connected client runs its own copy of these scripts, since a script can only modify its own cards.)*

### 6.4 `functions` (all need `await` except `getCardData`, `chatLog`)
| Call | Notes |
|---|---|
| `getCardData(card)` → {} | Static cards.json data for the card's current face (sync) |
| `moveCard(card, section, {noLogs}?)` | `card` is the object from `cards`, not an id |
| `moveCards(cards[], section, params?)` | Batch |
| `createCard(cardId, section)` → card | |
| `updateCards(cards[], changes)` | e.g. `{ isTapped:false }`; prefer over loops |
| `shuffleSection(name)` | |
| `draw(count, fromBottom?, targetSection?)` | **Only the player's own `Deck`**; calls `repositionCards` itself |
| `drawFromExtraDeck(deckSection, count, fromBottom?, forceDestination?)` | Draw from another `DECK` section |
| `getDeck()` → [] | Your deck, read-only; index 0 = bottom, last = top |
| `giveCardTo(card, playerId\|"UNOWNED", section?)` | Ownership transfer |
| `changeCounterValue(index, value)` | Native player counters (`countersStartingValues`) |
| `hideCards(cards[], "yes"\|"no"\|"opponent-only"\|playerId)` | |
| `payManaCost(costStr)` | Native autopay from the `Mana` section |
| `chatLog(msg)` | Log line (sync) |
| `repositionCards()` | Costly; once at the end of a script, never in a loop, never from `onCardsUpdate` carelessly (re-triggers it) |

**Hard rule:** *a script run by a player can only modify that player's own cards.*

## 7. Verified engine behavior not in the docs
- `countersStartingValues` must exist (see §3).
- `autoPlayFromHand` parent object and default-to-Stack (see §4.3).
- Native cost autopay only runs for a section that sets `autoPayFrom` (undocumented field); with none set, `cost` is purely informational. **Not** the cause of click crashes.
- Module-level `let`/`const` flags in the `.js` file did **not** persist across calls in live tests (docs never promise it). Keep state in `game.data`.
- `defaultRessources.backgrounds` missing → the board background becomes `url("undefined")` and the app requests `/undefined` (harmless).
- GitHub Pages sends `Cache-Control: max-age=600`: browsers can keep serving a previous `gamefile.json` for ~10 min after a push; force with a `cache:'reload'` fetch or wait.
- Direct loads of `/play` render blank here; enter via the home page, and the first Play render can take 10–30 s.
- `Start the game` → "Disable sideboard for all players" skips the sideboard screen. `Restart with the same decks` skips deck picking.
- **Cards in a shared extra-deck pile are tokens** (`isToken`, `tokenCount: 1`, shown with a "1" badge): see `tokenForbiddenSections` in §4.5. Inspect with the React fiber (`el.__reactFiber$…` → `memoizedProps.card`).
- `functions.getDeck()` returns **read-only** copies: `moveCard` on them is a silent no-op. Use `categoriesAlreadyOnBoard` instead.
- Regular-section `events.onCardsEnter` / `onCardsLeave` **work** (300 ms debounce, `transitionCards`). One event fires per section that lost cards, each with a snapshot of `cards` taken at that moment: a handler that fixes *other* sections from its own snapshot over-draws (Renovação over-filled 6/6/6). Keep each handler scoped to its own section.
- The app loads `gamefile.json` once per page load: refresh the HTTP cache (`fetch(url,{cache:'reload'})`) **before** reloading the page, not after.
- `input-number` spreads `props` onto the real `<input>`; size it with `props.style`.
- Hand/Território cards are drawn inside the section's rect: if the board is taller than 100vh the Hand is off-screen. Budget the layout in vh (ours: Território 10, Reserva 9, Deck/Discard/Remove 9, Hand 11, market rows 11, Campo 13 + shared 28).
- Test harness: the Browser pane must be *displayed* (hidden ⇒ blank renders and 45 s script timeouts); a synthetic or real-looking drag from the market to the Hand crashed the app once (`Cannot read properties of undefined (reading 'clients')`), so use the shortcut buttons.
- Share link: `https://tcg-arena.fr/load/` + base64(encodeURIComponent(gamefile URL)) (or the Custom games page).

## 8. Status of earlier hypotheses
Done and live-verified (see [DIAGNOSTICS.md](DIAGNOSTICS.md)): `autoPlayFromHand` moved to `sections`; Capital via `categoriesAlreadyOnBoard`; market ownership/refill via `onCardsLeave` + `game.isHost`; module flags removed; Reserva compact and last in `layout`; `translations.json` / `noAutoPayTo` removed.

Still open:
1. `melhoria-argentarii` has `cost: null` but `cost` is a required number (data fix; see README "Itens de dados a revisar").
2. Set `defaultRessources.backgrounds` (or accept the stray `/undefined` request).
3. Two-player behavior (guest buying, ownership of tokens, native player box vs Hand) is untested.
4. Remove the `debugBoard` helper and DEBUG button once play-testing is finished.
