<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/translations, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

# Translations 
 Translations panel

Fully optional. Skip this panel entirely if your game only needs one language.S stringN numberB boolean[] array{} object

There are two ways to translate text. For UI elements, you need a translation file (section names, format titles, help text). For cards, you can translate a card field directly when only that one card needs it or use the translation file when the same text repeats across many cards.

## Translating a card field directly 

Replace a plain value in `cards.json` with an object of per-language strings.

Any card field's plain value can be replaced with an object of per-language strings instead, to translate it directly on the card.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `en` | S | required | Default value, and the fallback used whenever the player's chosen language has no entry below. | `"Swift Falcon"` |
| `fr / de / zh / es` | S | optional | Translated value for that language code. Falls back to en when missing. possible values:`fr``de``zh``es` | `"Faucon Rapide"` |

```json
"name": {
  "en": "Swift Falcon",
  "fr": "Faucon Rapide"
}
```
`en` is always the default. If a player's language is French and the `fr` key is missing, the card falls back to `en` automatically.

> **WARNING:** 

The type field is the one exception

`type` can't be translated this way. It has to stay a plain string, since the engine uses it internally. To translate how a card type is displayed to players, use the translation file below instead.

## The translation file 

Point the top-level `translationsUrl` field at a separate JSON file. This file translates repeated text: section names, format titles, and any card field value that would otherwise need the same per-card translation over and over (a card type, a rarity, a color name).

A separate JSON file, referenced by the top-level translationsUrl field, that translates repeated text: section names, format titles, and any card field value that would otherwise need per-card translation.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `additionalLanguages` | [] | optional | Language codes players can pick from in the options menu, in addition to "en". Don't include "en" here, it's the default and never needs listing. possible values:`fr``de``zh``es` | `["fr", "de"]` |
| `en` | {} | required | All English text and value translations. Always required, since it's the fallback for every other language. | `{ "Gameplay": { "Aggro": "Aggro" } }` |
| `fr / de / zh / es` | {} | optional | Translations for that language. Only needed for languages actually listed in additionalLanguages. possible values:`fr``de``zh``es` | `{ "Gameplay": { "Aggro": "Agressif" } }` |

```json
{
  "additionalLanguages": ["fr"],
  "en": {
    "Card types": {
      "Creature": "Creature",
      "Spell": "Spell"
    },
    "UI text": {
      "translations.customHelp": "Drag a card onto the mana zone to add it as a resource."
    }
  },
  "fr": {
    "Card types": {
      "Creature": "Créature",
      "Spell": "Sort"
    },
    "UI text": {
      "translations.customHelp": "Jouez une carte dans votre zone de mana pour l'ajouter à vos ressources."
    }
  }
}
```
### How matching works 

**Plain keys match a literal value shown elsewhere in the app.** In the example above, wherever the engine displays the exact string `"Creature"` (a card's `type`, a section's name, a format's title), it looks it up in the current language's object and swaps in the translation if one exists. The sub-groups (`"Card types"` above) are purely for your own organization while editing the file. Matching scans every key in the language object regardless of which group it sits under, so you can nest things however keeps the file readable to you.

> **TIP:** 

Supported languages

Allowed codes are `en`, `fr`, `de`, `zh`, and `es`. `en` is always translated too (it's where your default text actually lives) but never goes in `additionalLanguages`, since it's already available by default.

