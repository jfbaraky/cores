<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

## What this file does 

A `gamefile.json` describes a game end to end: its name, how a legal deck is built, what happens on each turn, which board sections exist (units, ressorces, token zone...), and how they're laid out visually. The engine reads this file and renders the matching game. You never touch the engine's code.

> 

**Examples.** You can find full game files from complete games on Discord.

## Top-level structure 

| Key | Contains |
|---|---|
| `name` | The game's display name |
| `deckBuilding` | Playable formats and deck-construction rules |
| `gameplay` | One block per format: mulligan, turn structure, tokens, board layout |
| `defaultRessources` | Default background images and a link to prebuilt decks |
| `cards` | Where card data and the card-back image come from |

## Quick start 

This is the smallest valid file: a single section, nothing optional.

```json
{
  "name": "My Card Game",
  "deckBuilding": {
    "mainFilters": ["type", "cost"],
    "formats": [
      { "title": "Standard format", "gameplay": "Standard" }
    ]
  },
  "gameplay": {
    "Standard": {
      "mulligan": { 
        "startingHandSize": 5 
      },
      "newTurn": { 
        "drawPerTurn": 1 
      },
      "countersStartingValues": [],
      "sections": {
        "layout": {
          "direction": "column",
          "content": [{ "section": "Board" }]
        },
        "sectionsDict": {
          "Board": { "isHidden": "no", "height": "MEDIUM", "alignment": "CENTER" }
        }
      }
    }
  },
  "cards": {
    "dataUrl": "https://example.com/cards.json",
    "cardBack": "https://example.com/card-back.jpg"
  }
}
```
## General information 

Top-level fields that identify the game and its global behaviour.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `name` | S | required | Name of the game, shown in the game picker. | `"My Card Game"` |
| `menuBackgroundImage` | S | optional | URL of a background image for the menu screen. | `"https://example.com/bg.jpg"` |
| `cardRotation` | N | optional | Rotation in degrees applied to tapped cards. Default is 45 degrees.<format>. | `90` |
| `customHelp` | S | optional | Text shown to players in the Help menu in game. Supports \n for line breaks. | `"Drag a card onto the mana zone to add it as a resource."` |
| `translationsUrl` | S | optional | URL of a JSON file with UI and card text translations. | `"https://example.com/translations.json"` |

## Resources & cards 

Where the game's content lives: background images, prebuilt decks, and the card data itself.

Where the game's content lives.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `defaultRessources.backgrounds` | [] | optional | Background images offered to the player by default. | `["https://example.com/bg1.jpg"]` |
| `defaultRessources.decksUrl` | S | optional | URL of decks.json, the array of prebuilt starter decks, see the Card & deck files panel. | `"https://example.com/decks.json"` |
| `cards.dataUrl` | S | required | URL of the JSON file containing all cards for this game. | `"https://example.com/cards.json"` |
| `cards.cardBack` | S | required | Image shown for a face-down card. | `"https://example.com/back.jpg"` |
| `cards.cardBackColor` | S | optional | Color used for the card-pile height effect on decks. | `"#c8bdb3"` |
| `cards.extraCardBacks` | {} | optional | Alternate card-back images per card type, e.g. a distinct back for "Legend" cards. | `{ "Legend": "https://example.com/legend-back.png" }` |
| `cards.version` | N | optional | Only worth setting for a very large card file (~20MB+): it lets returning players skip re-downloading cards.json when nothing changed. Not needed for a typical-sized game. | `28` |

## Where to go next 

Five panels cover the rest of the configuration, each focused on one specific part:[**Deck building**
Formats and deck-construction rules.](/deck-building)[**Gameplay**
Mulligan, turns, tokens, board setup.](/gameplay)[**Sections & layout**
How the board itself is built. The densest chapter.](/sections)[**Card & deck files**
Generate cards.json and build prebuilt decks.](/content-files)[**Translations**
Optional: multiple languages for cards and UI text.](/translations)

