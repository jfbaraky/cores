<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/gameplay, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

# Gameplay 
 Gameplay panel

Everything under `gameplay.<format>` except `sections` (its own panel, see [Sections & layout](/sections)): the starting hand, how turns flow, tokens, and what's on the board before the first turn.S stringN numberB boolean[] array{} object

> **TIP:** 

Reminder: the name link

`gameplay.<format>` must be named exactly like the `gameplay` value used in a `deckBuilding.formats[]` entry. That's what connects a deck-building format to the rules on this page.

## General settings 

Match-wide settings that sit directly under a format's gameplay block, alongside mulligan/newTurn/sections.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `defaultNotes` | S | optional | Default text pre-filled in each player's notes panel, e.g. for tracking less important counters. | `"Poison: 0\nEnergy: 0"` |
| `countersStartingValues` | [] | optional | Starting values for the player counters shown on screen (e.g. life total), with one entry per counter and between 0 and 3 counters. | `[40, 0]` |
| `hideFacedDownCards` | B | optional | If true, face-down cards cannot be seen by their owner when hovering over them with the mouse. | `true` |
| `cardRotation` | N | optional | Overrides the top-level cardRotation for this format only. | `90` |

```json
"defaultNotes": "P1 life: 20\nP2 life: 20",
"countersStartingValues": [20]
```
## Mulligan 

The starting hand and the full mulligan procedure. Only startingHandSize is required. Skip postMulligan entirely if you don't need a second step.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `startingHandSize` | N | required | Number of cards drawn for the opening hand. | `7` |
| `triggeredByButton` | B | optional | If true, the mulligan panel doesn't appear automatically. The player opens it later with a button, whenever they're ready. | `true` |
| `mulliganCount.min / max` | N | optional | How many times a player may mulligan. If max is 0, the starting hand is drawn directly without ever showing the mulligan panel. | `{ "max": 1 }` |
| `mulliganCycle.info` | S | optional | Help text shown at the top of the mulligan panel. | `"Put back as many cards as you want."` |
| `mulliganCycle.steps` | [] | optional | The action sequence played on each mulligan, in order, pick only the ones you need. possible values:`toBottom``toTop``draw``shuffle``applyPenalty` | `["toBottom", "draw"]` |
| `mulliganCycle.selectionRange.min / max` | N | optional | How many cards the player must select. If max is greater than the hand size, the whole hand is mulliganed at once with no card-by-card selection. | `{ "min": 7 }` |
| `mulliganCycle.keepCardsOrder` | B | optional | Should cards go back into the deck in the order the player clicked them? | `false` |
| `postMulligan.minMulligansToTrigger` | N | optional | Number of mulligans after which this second step activates. | `2` |
| `postMulligan.info` | S | optional | Help text shown at the top of this second step. | `"Put back your remaining extra cards."` |
| `postMulligan.steps` | [] | optional | Same step values as mulliganCycle.steps, for this second step. applyPenalty reduces the hand size by one. It can be called multiple times to reduce it by more than one. possible values:`toBottom``toTop``draw``shuffle``applyPenalty` | `["toBottom"]` |
| `postMulligan.selectionRange.min / max` | N | optional | Same as mulliganCycle.selectionRange, for this second step. | `{ "min": 0, "max": 7 }` |
| `postMulligan.keepCardsOrder` | B | optional | Same as mulliganCycle.keepCardsOrder, for this second step. | `true` |

```json
"mulligan": {
  "startingHandSize": 7,
  "mulliganCount": { "max": 1 },
  "mulliganCycle": {
    "steps": ["toBottom", "draw"],
    "selectionRange": { "min": 7 }
  }
}
```
## New turn 

How turns are structured.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `drawOnStart` | B | required | Does the starting player draw automatically at the start of the first turn? | `true` |
| `drawPerTurn` | N | optional | Number of cards drawn at the start of turn. | `2` |
| `sharedTurn` | B | optional | Do all players act at the same time (true) or one after another (false)? | `false` |
| `turnOrder` | S | optional | Who plays next when a player ends their turn. possible values:`default``teamsAlternating``teamsSimultaneous` | `"teamsAlternating"` |
| `firstPlayerTokenName` | S | optional | Name of a token (from tokens[]) that marks which player currently has priority/initiative. | `"Initiative"` |

```json
"newTurn": {
  "drawOnStart": true,
  "drawPerTurn": 1
}
```
## Teams 

Adding a `teams` object turns a 4-player room into 2v2: the first two players to join become a team against the other two, and the board automatically switches to the 2v2 layout.

Note: teams turn order options are defined in newTurn.turnOrder.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `sharedPlayerCounter` | B | optional | If true, both teammates share a single counter (e.g. one team life total) instead of having one each. | `true` |
| `placement` | S | optional | How teammates are seated relative to each other. possible values:`sameSide``diagonal` | `"diagonal"` |
| `cardsVisibleToTeam` | B | optional | If true, your cards are also visible to your teammate (not just to you). | `true` |

```json
"teams": {
  "placement": "diagonal",
  "cardsVisibleToTeam": true
},
"newTurn": {
  "turnOrder": "teamsAlternating"
}
```
## Tokens 

Two arrays that are easy to mix up, because they're both called "tokens". The difference is **what they're attached to**:

> **TIP:** 

tokens vs draggableTokens

- **`tokens`** belong to a **player**. For example, tracking who currently holds a shared "Crown" token. Never attached to a card.
- **`draggableTokens`** belong to a **card**. Dragged onto one specific card as a marker (a shield, a damage counter). Never held by a player directly.

Tokens held by a PLAYER, not attached to any card, e.g. tracking a shared status like "who currently has priority". Shown once per player, near the player's counter.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `name` | S | required | Token name, must be unique. | `"Crown"` |
| `image` | S | required | Token image URL. | `"https://example.com/crown.png"` |
| `isUnique` | B | optional | Can only one instance of this token exist on the board? | `true` |
| `leavesAtEndOfTurn` | B | optional | Is the token automatically removed at end of turn? | `false` |

```json
"tokens": [
  { "name": "Crown", "image": "https://example.com/crown.png", "isUnique": true }
]
```
Tokens a player drags ONTO A CARD (not held by the player directly), e.g. a damage counter or a shield marker attached to one specific card. Unlimited quantity, one card can carry several. Each id must be unique.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | S | required | Unique identifier for this token. | `"Shield"` |
| `name` | S | required | Display name. | `"Shield"` |
| `image` | S | required | Token image URL. | `"https://example.com/shield.png"` |

```json
"draggableTokens": [
  { "id": "Shield", "name": "Shield", "image": "https://example.com/shield.png" }
]
```
## Initial board setup 

Some games deal cards automatically before the first turn: face-down prize cards, a starting board state, and so on. That's `beforeGameStart.initialBoardSetup`, an array of actions, each either drawing from a pile or creating a specific card directly.

Automates dealing cards before the first turn. Use either drawFromTop OR createCardId per entry, not both. Either a single array applied to every player, or an object keyed by player index ("0", "1"...) for setups that differ depending on the player's turn order position.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `drawFromTop` | S | optional | Draws from the top of a deck-like source. Use "Deck" or the name of an extra deck defined in sectionsDict. | `"Deck"` |
| `createCardId` | S | optional | Creates a specific card (by id from your cards.json). | `"cardId123"` |
| `count` | N | required | Number of cards to draw or create. | `3` |
| `destination` | S | required | Target section title (must exist in sectionsDict). | `"ShieldCards"` |
| `overrideState` | {} | optional | State to force on the resulting cards, e.g. tapped or hidden. | `{ "isHidden": "yes", "isTapped": true }` |
| `waitForPlayerTurn` | B | optional | Delays this setup action until it's actually that player's turn, instead of running it immediately at game start. | `true` |

```json
"beforeGameStart": {
  "initialBoardSetup": [
    { "drawFromTop": "Deck", "count": 3, "destination": "Prize" }
  ]
}
```
> **TIP:** 

Different setup per seat

`initialBoardSetup` can also be an object keyed by player index instead of a flat array, like `{ "0": [...], "1": [...] }`, when the two seats need different starting boards. Combine with `waitForPlayerTurn` to delay one seat's setup until it's actually their turn.

### Advanced setup options 

For games with a pre-match step beyond simple dealing: picking a leader, choosing what goes to the sideboard, letting players decide who starts.

Sit alongside initialBoardSetup, directly under beforeGameStart.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `boardCategoriesInSideboard` | [] | optional | Deck categories that start in the sideboard rather than the main deck, before any board setup runs. | `["Leaders", "Bases"]` |
| `boardCardSelection` | [] | optional | Prompts the player to pick cards from a category before the match starts, see "boardCardSelection[] entry" below. | `[ { "category": "LEADERS_DUO", "min": 2, "max": 2 } ]` |
| `chooseAnotherStartingPlayer` | B | optional | If true, the chosen starting player decides who goes first. | `true` |

One category the player must pick from before the match starts.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `category` | S | required | Deck category to pick from. | `"LEADERS_DUO"` |
| `min / max` | N | required | How many cards the player must select from this category. | `{ "min": 2, "max": 2 }` |
| `unselectedDestination` | S | optional | Where the cards NOT picked go, e.g. a hidden exile zone. | `"ExileHidden"` |

```json
"beforeGameStart": {
  "boardCategoriesInSideboard": ["Leaders"],
  "boardCardSelection": [
    { "category": "LEADER", "min": 1, "max": 1, "unselectedDestination": "ExileHidden" }
  ],
  "chooseAnotherStartingPlayer": true
}
```
Continue with [Sections & layout →](/sections), where the board itself gets built.

