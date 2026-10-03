<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/sections, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

# Sections & layout 
 Sections & layout panel

**The `layout` tree**: a recursive array of "containers" (rows/columns) that can themselves contain other containers.

**The `sectionsDict` dictionary**: an object mapping each section *name* used in the layout to its settings (size, alignment, visibility...).S stringN numberB boolean[] array{} object

## The layout tree 

`sections.layout` describes the **visual arrangement** of the board: which sections sit side by side, which are stacked. `direction` controls this literally. `"column"` stacks its children top to bottom, `"row"` places them side by side, left to right. A node can nest, so a column can contain a row as one of its children.

That diagram is the visual result of this exact JSON: a column with two children, first a section, then a nested row.

```json
{
  "direction": "column",
  "content": [
    { "section": "Board" },
    {
      "direction": "row",
      "content": [
        { "section": "Mana" },
        { "section": "Items" }
      ]
    }
  ]
}
```
The outer `column` stacks its two children top to bottom: first `Board`, then the row block. Inside that row block, `direction: "row"` places `Mana` and `Items` side by side. That's the whole mechanism. Nest `row`s and `column`s to build any arrangement, exactly like nested `<div>`s on a web page.

Every node in the tree has the same shape:

One node of the recursive layout tree, either a container (row/column) or a leaf pointing at a real section.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `direction` | S | optional | How this container's children are placed. Absent on a leaf. possible values:`row``column` | `"row"` |
| `content` | [] | optional | Children of this container. Each item is either another container or a leaf { "section": "..." }. | `[{ "section": "Hand" }]` |
| `section` | S | optional | Leaf only: the real section name, must exist as a key in sectionsDict. | `"Hand"` |
| `style` | {} | optional | Raw CSS styles applied to this node. | `{ "width": "20%" }` |
| `optional` | {} | optional | Makes this node an opt-in toggle: it starts disabled and players can enable or disable it during the match. The key is the label shown for that toggle. Multiple optional nodes can be toggled together if they share the same key. | `{ "key": "Sideboard zone" }` |
| `isSymmetricalForOpponents` | B | optional | Mirrors this node's content display order for the opponent's side of the board. Also mirrors style.marginLeft and style.marginRight. | `true` |
| `reverseForOppositeSide` | B | optional | Used only inside sections.sharedZone.layout (2v2), in place of isSymmetricalForOpponents: reverses this node for players 3 & 4. | `true` |

```json
{
  "direction": "row",
  "content": [
    { "section": "Bench", "style": { "width": "15vh" } },
    { "section": "Field" }
  ]
}
```
> **TIP:** 

Building your own

Start with a single leaf (`{ "content": [{ "section": "Board" }] }`), confirm it renders, then add one section at a time. Building the tree incrementally beats trying to write it all in one pass.

## Shared zone 

Some games have a zone that only exists **once**, shared by every player, instead of being duplicated on each side of the board. For example, a battlefield row in a two-team format. That's `sections.sharedZone`, a sibling of `layout`.

An optional zone shown once in the middle of the board, shared by all players instead of being duplicated per player like the rest of layout. Any section placed here lets every player put cards in it, though players can still only interact with their own cards. Sections used here still need an entry in the same sectionsDict as regular sections.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `height` | N | required | Height of the shared zone, in vh. | `14` |
| `layout` | {} | required | A layout tree, same node shape as sections.layout. For 2v2 boards, use reverseForOppositeSide on a node instead of isSymmetricalForOpponents. | `{ "direction": "column", "content": [ ... ] }` |

```json
"sharedZone": {
  "height": 14,
  "layout": {
    "direction": "column",
    "content": [{ "section": "Attackers" }]
  }
}
```
`sharedZone.layout` uses the exact same node shape as `layout` above. It's a separate tree, not a special node type.

## sectionsDict 

Once a section is placed in the `layout` tree, you still need to define **how it behaves**. Is it hidden from the opponent? How big? How aligned? That's `sectionsDict`, **not an array**, an object keyed by the exact name used in the layout.

The behaviour of one named section referenced by the layout tree.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `isHidden` | S | required | Determines who can see the cards when placed in this section. 'no' means everyone can see them, 'yes' means they are placed face down, and 'opponent-only' means they are face down only for opponents. A face-down card moved to another section remains face down. possible values:`no``yes``opponent-only` | `"no"` |
| `height` | S | required | Size of the section, one of the presets below (for prototyping), or a plain number to set an exact height in vh (recommended). possible values:`SMALL``MEDIUM``DEFAULT` | `"MEDIUM"` |
| `alignment` | S | required | How cards align within the section. possible values:`START``CENTER``END``NONE``DECK` | `"CENTER"` |
| `opponentAlignment` | S | optional | Overrides alignment specifically for how card align on the opponent's side. | `"END"` |
| `heightReference` | S | optional | Set to "horizontal" so this section's height is measured against a horizontal (rotated) card instead of an upright one, useful for a row meant only for tapped/rotated cards. possible values:`horizontal` | `"horizontal"` |
| `isHorizontalAllowed` | B | optional | Will a horizontal card appear horizontally in this section, or will it be forced to appear like a normal card? | `true` |
| `displayedTitle` | S | optional | Label shown above the section, if different from the section name/key. | `"Extra Deck"` |
| `noQuickActions` | B | optional | Disables the small button to quickly select all cards in the section. | `true` |
| `noAutoPayTo` | B | optional | Cards played here will never trigger the automatic card cost payment. | `true` |
| `isGroupForbidden` | B | optional | Prevents cards from being grouped below another card in this section. | `true` |
| `enterTapped` | B | optional | Cards entering this section start tapped/rotated. | `true` |
| `enterTapped` | {} | optional | Can also be defined as a map by card type. Cards entering this section will start tapped/rotated if their type is mapped to true. | `{ "Unit": true, "Artifact": false }` |
| `keepTappedNewTurn` | B | optional | Cards stay tapped across turn changes instead of auto-untapping. | `true` |
| `showHiddenCardInHistory` | B | optional | A faced-down card place in this section will be revealed in the game history/log. | `true` |
| `logWhenPlayed` | B | optional | Posts a line in the chat log whenever a card enters this section. | `true` |
| `cardActionShortcut` | {} | optional | Shows a different one-click shortcut on the top left corner of cards in this section, e.g. to move them straight to another section. | `{ "action": "MOVE", "actionData": { "destination": "Discard" } }` |
| `drawDestinations` | {} | optional | For a deck-like section (e.g. an extra deck): where a card goes when drawn from it, either by click or at new turn, keyed by card type. Use "_default" for any type not explicitly listed. | `{ "_default": "Stack", "Creature": "Board" }` |
| `cardBackColor` | S | optional | Overrides the global cards.cardBackColor setting when this section is used as an extra deck for the card pile effect. | `"#c8bdb3"` |

```json
"sectionsDict": {
  "Board": {
    "isHidden": "no",
    "height": "MEDIUM",
    "alignment": "CENTER"
  }
}
```
> **WARNING:** 

Common mistake

A section name used in `layout` (for example `"section": "Field"`) with no matching entry in `sectionsDict` won't render correctly. The two structures must stay in sync: layout says *where*, the dictionary says *how*.

> **WARNING:** 

No spaces in section names

Every key in `sectionsDict` (and every matching `"section": "..."` in `layout`) must be a single word with no spaces. Use `Extra_Deck` or `ExtraDeck`, never `Extra Deck`. Use `displayedTitle` if you want a label with spaces shown to the player.

### Extra decks 

An "extra deck" (a second, separate deck players draw or play from, common in many card games) is just a `sectionsDict` entry with `alignment: "DECK"`. Most of the optional fields aren't needed for a basic one.

```json
"sectionsDict": {
  "Extra-deck": {
    "isHidden": "yes",
    "height": "MEDIUM",
    "alignment": "DECK",
    "displayedTitle": "Extra deck"
  }
}
```
Clicking a card in this section plays it using the section's `autoPlayFromHand` value (below). Use `drawDestinations` on the same entry if drawn cards should scatter to different sections depending on card type instead of a single default.

### Auto-play destinations 

`autoPlayFromHand` and `autoPlayFromStack` are dictionaries, not arrays. They map a **card type** to the section it lands in, so each type only needs one destination.

Dictionaries mapping a card type to the section it should land in when the player clicks it from hand, or resolves it from the the stack.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `autoPlayFromHand` | {} | optional | Where a card goes when played directly from hand, keyed by card type. Use "GROUP" as a destination to attach it to another card. | `{ "Creature": "Board", "Item": "GROUP" }` |
| `autoPlayFromStack` | {} | optional | Where a card goes once it finishes resolving from the stack, keyed by card type, typically "Discard" for spells, or a permanent's board section. Use "GROUP" as a destination to attach it to another card. | `{ "Spell": "Discard" }` |

```json
"autoPlayFromHand": {
  "Creature": "Board",
  "Resource": "Mana",
  "Spell": "Stack"
},
"autoPlayFromStack": {
  "Spell": "Discard"
}
```
### Custom sections 

A custom section **isn't a separate structure**. It's a normal `sectionsDict` entry, just with `"type": "custom"` instead of the usual `isHidden`/`height`/`alignment` fields. Use it for a section that renders a small UI instead of cards, such as a life or mana counter panel, described as a tree of elements (much like HTML) via `blueprint`.

Not a separate structure. This is a normal sectionsDict entry, just with type: "custom" instead of the usual isHidden/height/alignment fields, which renders a small UI (e.g. a counter panel) instead of cards.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `type` | S | required | Must be "custom" to enable this mode. possible values:`custom` | `"custom"` |
| `defaultValue` | {} | optional | Initial state stored for this section, later accessible via game.data.<SectionName>. | `{ "white": 0, "blue": 0 }` |
| `blueprint` | {} | required | The UI element tree (type, props, children) that renders this section. onChange expressions have access to value (the new value), delta (the change amount), and a chatLog(message) helper to post to the game log. | `{ "type": "div", "children": [ ... ] }` |
| `isShared` | B | optional | If true, this custom section's state is shared/visible across all players rather than being per-player. | `true` |
| `events` | {} | optional | Script expressions run on specific triggers. possible values:`onStart``onNewTurn``onOpponentUpdate` | `{ "onNewTurn": "game.data.Boost.value = 0" }` |

```json
"sectionsDict": {
  "Counters": {
    "type": "custom",
    "defaultValue": { "white": 0, "blue": 0 },
    "blueprint": {
      "type": "div",
      "children": [
        {
          "type": "input-number",
          "props": { "value": "{{ game.data.Counters.white }}" },
          "onChange": "game.data.Counters.white = value"
        }
      ]
    }
  }
}
```
A custom section can also react to game events instead of only user input. See the `events` row in the table above (`onStart`, `onNewTurn`, `onOpponentUpdate`).

> **TIP:** 

Placement matters

Custom sections are often positioned with absolute CSS (`position: absolute`) so they can float over the board. Place them **last** in your `layout` tree, otherwise a section defined after them can end up rendered on top and block their inputs from being clicked.

This mode is more technical than the rest of the file. For a first game, it's fine to define only plain sections and add a custom one later if you need a specific widget.

## Naming conventions 

A handful of section names carry built-in meaning, or are reserved outright. No extra config needed beyond naming the section this way (or avoiding the name) in `sectionsDict`.

> **TIP:** 

Special name: "Mana"

Naming a section **`Mana`** makes the engine display a simple card-count indicator for that zone instead of rendering full cards. Useful for a resource pool where only the count matters, not which cards are in it.

> **WARNING:** 

Reserved names

`Stack`, `Hand`, `Deck`, `Discard`, `Sideboard`, `Remove`, and `RemoveHidden` are used internally by the engine. Don't use them as the name of a new custom section. Only reference them in `sectionsDict` if you're deliberately overriding one of the engine's own built-in sections.

## Cheat sheet 

| Structure | Role |
|---|---|
| `layout` | Visual arrangement, who sits next to who. A tree of rows/columns, duplicated per player. |
| `sharedZone` | Same tree shape as `layout`, but rendered once and shared by all players. |
| `sectionsDict` | Behaviour of each named section: size, visibility, alignment. |
| `blueprint` | Custom sections only, a small UI described as a tree of elements. |

