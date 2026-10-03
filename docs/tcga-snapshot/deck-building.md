<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/deck-building, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

# Deck building 
 Deck building panel

Everything under `deckBuilding`: which formats are offered when a player builds a deck, and what legality rules apply to each. This is the part of the file read *before* a match starts.S stringN numberB boolean[] array{} object

## Deck building 

Everything that happens before a game starts: which formats are offered and how deck legality is enforced.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `mainFilters` | [] | required | Filter that appears below the search bar without having to open the filter menu. | `["type", "cost", "aspects"]` |
| `costCurveIgnoredTypes` | [] | optional | Card types excluded from the cost curve chart. | `["Land"]` |
| `formats` | [] | required | One entry per playable format. Each entry is a full object, see "formats[] entry" below. | `[{ "title": "Standard", ... }]` |
| `deckRulesets` | {} | optional | Dictionary of deck-building rulesets, keyed by name and referenced by formats[].deckRuleset. Optional, a format without a matching ruleset simply has no min/max enforcement. | `{ "Standard": { ... } }` |

```json
"deckBuilding": {
  "mainFilters": ["type", "cost", "color"],
  "formats": [
    { "title": "Constructed", "gameplay": "Standard" },
    { "title": "Limited", "gameplay": "Standard" }
  ]
}
```
> **TIP:** 

A format doesn't need a ruleset

`deckRuleset` and `deckRulesets` are both optional. Some games define two formats that share the same `gameplay` block and skip deck-building restrictions entirely.

## Formats 

Each element of `deckBuilding.formats` is a mode offered to the player, independent from the others.

One playable format, offered to the player when building a deck.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `title` | S | required | Display name in the format picker. | `"Standard format"` |
| `customCategories` | [] | optional | Deck categories specific to this format (e.g. a separate "Extra deck" or "Leader" slot). | `["Extra deck"]` |
| `legalityCode` | S | optional | Code used to filter which cards are legal in this format. | `"COR"` |
| `gameplay` | S | required | Must match a key under the top-level gameplay object. This determines the gameplay used when playing with this deck | `"Standard"` |
| `deckRuleset` | S | optional | Must match a key under deckBuilding.deckRulesets. Omit if the format has no ruleset restrictions. | `"Classic"` |

```json
{
  "title": "Constructed",
  "legalityCode": "STD",
  "gameplay": "Standard",
  "deckRuleset": "Standard"
}
```
> **TIP:** 

Reusing a gameplay block across formats

Several formats can share one `gameplay` block. If "Constructed", "Historic" and "Legacy" only differ in which cards are legal, give them the same `"gameplay": "Standard"` and `"deckRuleset": "Standard"`, and vary only `title` and `legalityCode`. No need for a new `gameplay` block per format when the match rules are identical.

## Deck rulesets 

Not an array. An object keyed by ruleset name, referenced by `formats[].deckRuleset`.

Construction rules referenced by one or more formats.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `checkCardLegality` | B | optional | If true, checks that every card carries the format's legalityCode. | `true` |
| `general.min / max` | N | optional | Total number of cards allowed in the main deck. | `{ "min": 60 }` |
| `general.maxPerCard` | N | optional | Maximum copies of a single card allowed. | `4` |
| `categories` | [] | optional | An array of card types or custom categories to which specific rules apply (e.g. exactly 1 to 2 Leader cards). | `[ { "category": "Leader", "min": 1, "max": 2 } ]` |

```json
"deckRulesets": {
  "Limited": {
    "general": { "min": 40, "maxPerCard": 4 },
    "categories": [
      { "category": "Sideboard", "min": 0, "max": 15 }
    ]
  }
}
```
Continue with [Gameplay →](/gameplay) or [Sections & layout →](/sections).

