<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/scripting, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

# Scripting 
 Scripting panel

Fully optional. Only use this for advanced behavior.

> **TIP:** 

Advanced

This is the most advanced and complicated thing you can do on a TCG Arena game file. Before adding scripting to your game, make sure the rest of your game file works properly, and that you have basic knowledge of Javascript.S stringN numberB boolean[] array{} object

Scripting is done in two parts:

- A series of `sectionsDict` entries with `type: "custom"`. This is where you call functions from your `.js` files, and build custom rendering blocks to display values and let players interact with them.
- A series of `.js` files. You can have any number of them: declare their URLs in the `scriptsUrls` array of your `game.json`. They contain all the functions that get called throughout the game.

## Custom type sections 

Declared in your `sectionsDict` using `type: "custom"`. Instead of holding cards, this kind of section renders a small custom UI (a counter, a button, a status panel...) built from a `blueprint`, and can react to game events through `events`. Add them to your `layout` like regular sections.

```json
"MyIdentity": {
  "type": "custom",
  "defaultValue": { "hp": 0 },
  "blueprint": {
    "type": "div",
    "children": [
      { "type": "button", "children": "Draw", "onClick": "await draw()" }
    ]
  },
  "events": {
    "onStart": "game.data.MyIdentity.hp = 10"
  }
}
```
`defaultValue` is the initial content of `game.data.<SectionName>`. Set `isShared: true` if this section's state should be shared across all players instead of being per-player.

### The blueprint tree 

A `blueprint` is a tree of nodes. Each node is either a plain string (rendered as text, see [`" expressions ' below) or an object describing one UI element.

One node of the blueprint tree. A node is either a plain string, or an object with the fields below.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `type` | S | required | "button", "IMG", "input-number", "loop", or any standard HTML tag name (e.g. "div", "span"). For images and number inputs, use respectively "IMG" and "input-number" instead ot their standard HTML tag. | `"button"` |
| `props` | {} | optional | Props/attributes passed to the underlying element (className, style, value...). String values support {{ }} expressions. | `{ "className": "box" }` |
| `children` | ? | optional | A single node, a string, or an array of nodes, rendered inside this one. | `"{{ game.data.MyIdentity.hp }}"` |
| `onClick` | S | optional | Script run when this node is clicked. See the event context below. | `"await draw()"` |
| `onChange` | S | optional | Script run when this input-number changes. See the event context below. | `"game.data.MyIdentity.hp = Number(value)"` |
| `iterable` | S | optional | Only for type: "loop". A {{ }} expression resolving to an array from game. | `"{{ game.data.MyIdentity.upgrades }}"` |
| `template` | {} | optional | Only for type: "loop". The node repeated for each item, with item.<field> and [index] available inside it. | `{ "type": "div", "children": "{{ item.name }}" }` |

Any `type` not in this special list (`button`, `IMG`, `input-number`, `loop`) is rendered as a plain HTML tag of that name: `"type": "div"` becomes a `<div>`, `"type": "span"` becomes a `<span>`, and so on.

#### Reading values with `{{ }}` 

Any string in a blueprint (a text child, or a prop value) can contain a `{{ expression }}`. The expression is evaluated against `game`, it's read-only and re-evaluated on every render, and it can't call `functions` or mutate anything.

```json
{ 
  "type": "div", 
  "children": "{{ game.data.MyIdentity.hp }} HP" 
}
```
```json
{ 
  "type": "input-number",
  "props": { 
    "value": "{{ game.data.MyIdentity.hp }}" 
  } 
}
```
#### Repeating nodes with a loop 

Use `"type": "loop"` to render one node per item of an array from `game`:

```json
{
  "type": "loop",
  "iterable": "{{ game.data.OppGigs.dices }}",
  "template": {
    "type": "button",
    "children": "{{ item.name }}",
    "onClick": "game.data.OppGigs.dices[index].stolen = true"
  }
}
```
Inside `template`, `item` refers to the current element, and `[index]` can be used to change a value at the item index.

#### Running scripts with `onClick` / `onChange` 

`onClick` (on any node type) and `onChange` (on `input-number`) take a string of Javascript, run through the same sandbox as your `.js` files. They have access to `game`, `cards`, `functions`, and a few extra values tied to the interaction itself:

Identifiers available inside any script string run from a blueprint node's onClick/onChange, or from events.

| Field | Type | Description | Example |
|---|---|---|---|
| `game` | {} | See the game object below. | `game.data.MyIdentity.hp` |
| `cards` | {} | See the cards object below. | `cards.Hand` |
| `functions` | {} | See the functions object above. | `await functions.draw(1)` |
| `value` | S | onChange only: the new value of the input. | `42` |
| `delta` | N | input-number onChange only: how much the value changed by (new - old). | `2` |
| `deltaDisplay` | S | input-number onChange only: the same change formatted with a sign, e.g. "+2" or "-3". | `"+2"` |

```json
{
  "type": "input-number",
  "props": { "value": "{{ game.data.MyIdentity.hp }}" },
  "onChange": "game.data.MyIdentity.hp = Number(value); functions.chatLog('HP ' + deltaDisplay)"
}
```
Calling a function declared in one of your `.js` files works the same way. Just don't forget `await` if it's `async`:

```json
{ 
  "type": "button", 
  "children": "Draw", 
  "onClick": "await draw()" 
}
```
### Events 

`events` runs a script automatically when something happens, without needing a player to click anything. Every value follows the same rules as `onClick` above: a script string, run in the same sandbox, with the same context.

| Event | Fires when... |
|---|---|
| `onStart` | Format has been selected, deckPicker is opening. |
| `onPlayersDeckPicked` | Every player has finished picking their deck. |
| `onPlayersSideboardClosed` | Every player has finished switching cards with their sideboard. |
| `onPlayersBoardCardSelected` | Every player has finished making their card selection for those that starts on the board. |
| `onPlayersMulligan` | Every player has finished taking their mulligan. |
| `onPlayersReady` | Every player has finished all pre-game steps and are ready to play. |
| `onNewTurn` | A new turn begins (any player, not only for the active player). |
| `onUpdate` | Any value inside this section's own `game.data` changes. |
| `onOpponentUpdate` | The opponent's section with the same key had a change to it's `game.data` value. |
| `onCardsUpdate` | A card changes happened anywhere on the board (moved, tapped, created...). The call is debounced: it fires once, shortly after the last change, never once per individual card. |
| `onCardsEnter` | This event can only be added to a regular section. It is triggered whenever one or more cards enter the section. The cards that triggered the event are available in the `transitionCards` object as they were before entering. |
| `onCardsLeave` | This event can only be added to a regular section. It is triggered whenever one or more cards leave the section. The cards that triggered the event are available in the `transitionCards` object as they were before leaving. |

> **WARNING:** 

WARNING

Don't confuse `onUpdate` (your own section's data changed) with `onCardsUpdate` (a card changed anywhere on the board).

> **WARNING:** 

WARNING

Use `onOpponentUpdate` carefully as changing your section data on an opponent change can lead to an infinite loop if you all keep reacting to each other changes.

## Javascript files 

Functions in these files are usually declared `async`, since most of them need to wait for an action to actually apply on the board. They have access to three things without needing to declare them as parameters: `cards`, `game`, and `functions`.

```js
async function drawStartingHand() {
  const identityCard = cards?.Identity?.[0]
  if (!identityCard) return
  const cardData = functions.getCardData(identityCard)
  await functions.draw(cardData?.handSize ?? 0)
}
```
Give it a unique name, then call it from a `custom` section's `blueprint` or `events` (see above).

### Accessing cards 

You can read every card currently in your own sections and in the shared/common sections through the `cards` object. It's **read-only**, mutating a card here has no effect on the board, use the [functions below instead. Cards are grouped in arrays, one per section.

```js
const topCard = cards.EncounterDeck[cards.EncounterDeck.length - 1]
const hasEnemies = (cards.EngagedEnemies ?? []).length > 0
```
One entry per section currently holding cards in yours or shared zone sections. Read-only.

| Field | Type | Description | Example |
|---|---|---|---|
| `cards.<SectionName>` | [] | Array of card objects currently in that section (see the card object shape below). Missing/empty sections aren't guaranteed to be present, always guard with ?. | `cards.Hand ?? []` |

Each card in these arrays has the following shape:

The shape of a single card as read from the cards object.

| Field | Type | Description | Example |
|---|---|---|---|
| `id` | S | Unique runtime id of this card instance. | `"c-9f2a"` |
| `isTapped` | B | Is the card currently tapped. | `true` |
| `isFlipped` | B | Is the card showing its back face (for dual faced cards). | `false` |
| `owner` | S | Player id that owns this card, or "UNOWNED" for a common/shared card. | `"UNOWNED"` |
| `counters` | [] | Per-card counters, always two even when empty. | `[{}, { "value": 3 }]` |

### Accessing game data 

The `game` object contains information about the lobby, the current player, and your custom sections' data.

Values you can access in the game object.

| Field | Type | Description | Example |
|---|---|---|---|
| `data` | {} | Your custom sections' current values, keyed by section name, same shape as each section's defaultValue. Mutate it directly to update a section. | `game.data.MyIdentity.hp = 10` |
| `isHost` | B | True if the current player is the host of the match. | `true` |
| `turn.totalPlayers` | N | Total number of players in the match. | `4` |
| `turn.orderPosition` | N | The current player's turn order position (0-indexed). | `0` |
| `turn.count` | N | Current global sum of all players turn count. | `17` |
| `turn.isMyTurn` | B | Is it currently this player's turn. | `true` |

### Using built-in functions to interact with the board 

The `functions` object contains all the tools you need to automate actions on the player's cards. You can only do things that a player could have done themselves. Remember that a script run by a player **can only modify its own cards**.

Every function needs `await`, except `getCardData` and `chatLog`, which resolve immediately.

#### `functions.getCardData(card)` 

Synchronous read of a card's static definition (same data as in your `cards.json`), resolved for its current face. No `await` needed.

- `card` {} *(required)*: the card object to read, from `cards`.

Returns {}

```js
const data = functions.getCardData(card)
```
#### `functions.moveCard(card, targetSection, params?)` 

Moves a card to another section.

- `card` {} *(required)*: the card object to move, read from `cards` (not just its id).
- `targetSection` S *(required)*: name of the destination section, must exist in `sectionsDict`.
- `params` {} *(optional)*: extra options: 

  - `noLogs` B *(optional)*: if true, this move isn't posted to the game history/log.

```js
await functions.moveCard(card, "Discard")
```
#### `functions.moveCards(cards, targetSection, params?)` 

Batched equivalent of `moveCard`: moves several cards to the same section at once.

- `cards` [] *(required)*: array of card objects to move, read from `cards`.
- `targetSection` S *(required)*: name of the destination section.
- `params` {} *(optional)*: same options as `moveCard`'s `params`, applied to every card.

```js
await functions.moveCards(cards.Allies, "Discard")
```
#### `functions.createCard(cardJsonFileId, targetSection)` 

Creates a new card instance directly into a section.

- `cardJsonFileId` S *(required)*: id of the card as defined in your `cards.json`.
- `targetSection` S *(required)*: name of the section the new card enters.

Returns {}: the created card.

```js
const c = await functions.createCard("01094", "Villain")
```
#### `functions.updateCards(cardsArray, changes)` 

Applies the same set of property changes to several cards at once. Prefer this over calling other functions in a loop when touching more than one card.

- `cardsArray` [] *(required)*: array of card objects to update, read from `cards`.
- `changes` {} *(required)*: properties to set on every card in `cardsArray`.

```js
await functions.updateCards(cards.Allies, { isTapped: false })
```
#### `functions.shuffleSection(sectionName)` 

Shuffles all cards currently in a section.

- `sectionName` S *(required)*: name of the section to shuffle (an extra deck is a section too).

```js
await functions.shuffleSection("EncounterDeck")
```
#### `functions.draw(count, drawFromBottom?, targetSection?)` 

Draws card(s) from the player's deck to their hand (or optionally to any other section). Already calls `repositionCards()` itself.

- `count` N *(required)*: number of cards to draw.
- `drawFromBottom` B *(optional)*: draw from the bottom of the deck instead of drawing from the top.
- `targetSection` S *(optional)*: section to add the drawn cards. Hand if not specified.

```js
await functions.draw(1, false, "ShieldSection")
```
#### `functions.drawFromExtraDeck(extraDeck, count, drawFromBottom, forceDestination)` 

Draws from a named extra-deck-type section, similar to `draw()`.

- `extraDeck` S *(required)*: extra deck section name to draw from.
- `count` N *(required)*: number of cards to draw.
- `drawFromBottom` B *(optional)*: draw from the bottom of the deck instead of drawing from the top.
- `forceDestination` S *(optional)*: force the target section to add the drawn cards instead of adding it to the default draw destination of the extra deck section.

```js
await functions.drawFromExtraDeck("RessourceDeck", 2)
```
#### `functions.giveCardTo(card, targetPlayerId, section?)` 

Transfers ownership of a card to another player.

- `card` {} *(required)*: the card object to transfer.
- `targetPlayerId` S *(required)*: id of the player who becomes the new owner, or `"UNOWNED"` to make the card ownerless.
- `section` S *(optional)*: section the card lands in for its new owner. Defaults to its current section if omitted.

```js
await functions.giveCardTo(card, "UNOWNED", "EncounterDeck")
```
#### `functions.changeCounterValue(counterIndex, value)` 

Sets one of the player's counters to a new value.

- `counterIndex` N *(required)*: index of the counter to change (see `gameplay.countersStartingValues`), 0-based.
- `value` N *(required)*: new value for that counter.

```js
await functions.changeCounterValue(0, 20)
```
#### `functions.chatLog(message, params?)` 

Posts a line to the game log. No `await` needed.

- `message` S *(required)*: message or log key to post.

```js
functions.chatLog("has clicked the forbidden button")
```
#### `functions.hideCards(cardsArray, status)` 

Change the visibility of a cards array.

- `cardsArray` [] *(required)*: the array of cards whose visibility will be changed.
- `cardsArray` S *(required)*: determines who can see the cards. Can be: `"yes"`: the cards are visible to everyone. `"no"`: the cards are hidden from everyone. `"opponent-only"`: the cards are visible only to opponents. A `playerId`: toggles the visibility of each card for the specified player based on its current visibility to that player.

```js
await functions.hideCards(secretZoneCards, "no")
```
#### `functions.getDeck()` 

Returns the player's deck in read-only mode.

Returns []: the player's deck. Index `0` represents the bottom of the deck, while the last index represents the top.

```js
await functions.getDeck()
```
#### `functions.payManaCost(costStr)` 

Pays as much as possible of the `costStr`using cards in the `Mana`section.

- `costStr` S *(required)*: string representing the cost to pay.

```js
await functions.payManaCost("{5}{W}{W}")
await functions.payManaCost("6")
```
#### `functions.repositionCards()` 

Re-lays out the board. Takes no parameters.

```js
await functions.repositionCards()
```
> **WARNING:** 

Performance

Call this at most once, at the end of your script, and only if the last built-in function you called doesn't already call it (see each function above). It's the most performance-costly function you can call. **Never call it inside a loop!**

Calling it from an `onCardsUpdate`-triggered script (see [events above) can cause an infinite loop if not handled carefully, since it will itself trigger a new `onCardsUpdate` event. Always be careful when using this function from that context.

