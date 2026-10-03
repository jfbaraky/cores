<!-- Verbatim snapshot of https://documentation.tcg-arena.fr/content-files, fetched 2026-10-03. Auto-converted from the VitePress HTML (not summarized). Tables/code blocks preserved; type legend and 'possible values' lists are fused into single lines by the converter. -->

# Card & deck files 
 Card & deck files panel

`cards.json` (pointed to by `cards.dataUrl`) is **not written by hand** (recommended). You generate it from whatever source already holds your card data (a spreadsheet export, a CMS, an API...). `decks.json` (pointed to by `defaultRessources.decksUrl`) is the opposite. You build each deck yourself in the app's deck builder, the same way a player would.

## Card file 

`cards.json` is a **dictionary keyed by card id**, not an array. Each entry needs at least the shape below. `face.front` holds what's shown on the card, and the flat `name`/`type`/`cost` fields are used by search and deck-building filters.

```json
{
  "cardId": {
    "id": "cardId",
    "face": {
      "front": {
        "name": { "name": "cardName" },
        "type": "cardType",
        "cost": 3,
        "image": "https://example.com/cards/cardId.webp"
      }
    },
    "name": "cardName",
    "type": "cardType",
    "cost": 3
  }
}
```
All values

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | S | required | Card id, same value as the card key in the file. | `card-092` |
| `type` | S | required | The card type value when deckbuilding. | `card-092` |
| `cost` | N | required | The card cost value when deckbuilding. | `card-092` |
| `ANYTHING` | ? | optional | Any additional values that will appears as filters when deckbuilding. possible values:`number``string``array` | `"color": ["red", "yellow"]` |
| `face.front` | {} | required | Front face of a card. Must have a name, type, cost and image. Those type and cost values will the one used when playing the card. | `{ "name": "cardName", "type": "cardType", "cost": 3, "image": "cardImageUrl" }` |
| `face.back` | {} | optional | Same as the front face but for the back of a dual faced card (see Dual faced cards below). | `{ "name": "cardName", "type": "cardType", "cost": 3, "image": "cardImageUrl" }` |
| `isHorizontal` | B | optional | Is the card always shown tapped at 90 degrees. | `true` |
| `isToken` | B | optional | Is the card a token? If yes, it can only be created during a game and can't be added to a deck itself. | `true` |
| `tokens` | [] | optional | Array of other cardIds that the card can quickly create when right clicking it (see Token creation shortcut below). | `['card-003', 'card-291']` |
| `legality` | {} | optional | Map of available legalityCode to restrict the card availability or count depending on the chosen format (see Card legality below). | `{"CORE": true}` |

### Dual faced cards 

If the card has a playable back, you can add a back face as shown below.

```json
{
  "cardId": {
    "id": "cardId",
    "face": {
      "front": {
        "name": { "name": "cardName" },
        "type": "cardType",
        "cost": 3,
        "image": "https://example.com/cards/cardId.webp"
      },
      "back": {
        "name": { "name": "backCardName" },
        "type": "backCardType",
        "cost": 7,
        "image": "https://example.com/cards/backCardId.webp"
      }
    },
    "name": "cardName",
    "type": "cardType",
    "cost": 3
  }
}
```
> **TIP:** 

`face.back` is not for regular card back

The regular card back image is defined in the `gamefile.json`. `face.back` is optional and only for cards that can be flipped to play the back face instead of the front face.

### Card legality 

If you have defined in your deckbuilding format a `legalityCode`, add a `_legal` map to your cards with a key for each `legalityCode` you have defined. The code value can be `true` if he card is legal, `false` if the card is not legal, or a `number` to override the deckbuilding limit for this card.

```json
{
  "cardId": {
    "id": "cardId",
    "face": {},
    "_legal": {
      "CODE1": true,
      "CODE2": false,
      "CODE3": 9999
    }
  }
}
```
### Token creation shortcut 

Add a `tokens` array of card ids to any card entry (referencing other entries in the same `cards.json`) to let players right-click that card and create one of those as a token, the same way some games let certain cards summon their own token creatures. The referenced card can be any card and doesn't need to be a token itself. Whatever gets created through this field is simply treated as one.

Having cards on the board with a token shortcut will make them available in the section's quick action menu.

### Advanced mana 

Instead of a plain number, the `cost` value on `face.front` and `face.back` (never on the root) can be a **string** built from symbols in curly braces:

- `{N}`: N generic mana, payable with any mana source.
- `{C}`: one colorless mana. Colorless can only be paid with a colorless source.
- `{X}`: one mana of color `X`. Colors aren't hardcoded: `X` can be any label your game uses (`W`, `Fire`, `1`... whatever fits your color pie).
- `{X/Y}`: one mana of either color `X` or `Y`, whichever autopay finds more convenient to pay.
- `{N/X}`: either `N` generic mana, or one mana of color `X`. Autopay tries `X` first and only falls back to `N` generic if nothing on the board produces `X`.

A cost can combine several symbols, e.g. `"{2}{W}{U/R}"` means 2 generic mana, one white, and one blue-or-red.

> **TIP:** 

Variable costs

This engine has no concept of a player-chosen value resolved at cast time (an "X cost"). If your game has that mechanic, resolve it to a fixed number before writing it to `cards.json` (commonly 0), or build your own input flow for it, otherwise autopay will treat the unrecognized symbol as a literal color, not a variable.

To let a card **produce** mana when tapped, add a `_mana` array [] to `face.front` and/or `face.back` (never the root). Each entry is one activatable ability, written as a string in the form `<additional cost>:<mana produced>`.

Tapping the card itself is always implied and never needs to be written, it's the one thing every ability shares. The part before the colon is any *extra* cost required on top of tapping, using the same `{}` syntax as above, left empty for a free ability:

```json
"_mana": [":{W}", "{1}:{U}{U}"]
```
The first ability taps the card for free to produce one white mana. The second costs 1 additional generic mana, paid from other sources, to produce two blue mana.

On the production side (after the colon):

- Concatenated symbols (`{W}{B}`) mean that many mana are produced at once.
- `{X/Y}` means the card produces one mana that resolves as either color, whichever is more useful at the time.
- `{Any}` means one mana of any color (colorless excluded).
- If a single ability can produce different, non-interchangeable combinations (e.g. either two of the same color or one of each of two different colors), separate them with `|`: `"{W}{W}|{U}{R}"`.

Whenever using advanced mana, autopay looks at every untapped card in the mana zone, works out which combination of taps (including activating paid abilities, whose own cost gets paid for the same way), covers the cost, and taps them. It favors free sources over paid ones when both work equally well, prefers a source that produces exactly the color needed over one that could produce several, and avoids wasting produced mana whenever an alternative exists.

> **TIP:** 

Keeping things simple

None of this is required. If `cost` is left as a plain number, autopay falls back to the original behavior: it taps that many untapped cards from the mana zone, one card counting for exactly one mana, ignoring `_mana` entirely.

## Card file generation scripts 

Both scripts below do the same thing: loop over your raw card data and write `cards.json`. They only differ in *where the raw data comes from*. The only part you need to edit is `mapCard()`: fill in whatever fields your own source actually has.

### Generation script from a URL 

```js
// generate-cards-from-url.js
import fs from 'fs'

const SOURCE_URL = 'https://example.com/my-raw-cards.json'

// The only function you need to edit: map your raw card
// data to the shape gamefile.json expects.
function mapCard(raw) {
  return {
    id: raw.id,
    face: {
      front: {
        name: { name: raw.name },
        type: raw.type,
        cost: raw.cost,
        image: raw.imageUrl
      }
    },
    name: raw.name,
    type: raw.type,
    cost: raw.cost
  }
}

async function main() {
  const res = await fetch(SOURCE_URL)
  const rawCards = await res.json()

  const cards = {}
  for (const raw of rawCards) {
    const card = mapCard(raw)
    cards[card.id] = card
  }

  fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2))
  console.log(`Wrote ${Object.keys(cards).length} cards to cards.json`)
}

main()
```
### Generation script from a local JSON file 

```js
// generate-cards-from-local-file.js
import fs from 'fs'

const SOURCE_FILE = './raw-cards.json'

// The only function you need to edit: map your raw card
// data to the shape gamefile.json expects.
function mapCard(raw) {
  return {
    id: raw.id,
    face: {
      front: {
        name: { name: raw.name },
        type: raw.type,
        cost: raw.cost,
        image: raw.imageUrl
      }
    },
    name: raw.name,
    type: raw.type,
    cost: raw.cost
  }
}

function main() {
  const rawCards = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'))

  const cards = {}
  for (const raw of rawCards) {
    const card = mapCard(raw)
    cards[card.id] = card
  }

  fs.writeFileSync('cards.json', JSON.stringify(cards, null, 2))
  console.log(`Wrote ${Object.keys(cards).length} cards to cards.json`)
}

main()
```
Run either with `node generate-cards-from-url.js`, then point `cards.dataUrl` at wherever you host the resulting `cards.json`.

## Prebuilt decks 

`defaultRessources.decksUrl` is optional. It points to `decks.json`, an **array** of starter decks players can pick up and play immediately, with no deck-building required.

Unlike `cards.json`, this one really is recommended to be built by hand, the same way you'd build any deck: use the in-app deck builder, then **Export → Starter Deck**, and paste the resulting decklist into the array. The array of pasted decklists *is* `decks.json`, one entry per starter deck you want to offer.

> **TIP:** 

No decksUrl? No problem

Both `defaultRessources.backgrounds` and `decksUrl` are optional. Skip `decksUrl` entirely if you don't want to offer prebuilt decks yet.

