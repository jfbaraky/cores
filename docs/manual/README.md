# Cores da Guerra — Manual de Regras (v1, working version)

`cores-da-guerra-manual-v1.pdf` is the rulebook the game is being built from (40 pages, Portuguese).
The original PDF (`cores-da-guerra-manual-v1-2.pdf`, from Downloads) is no longer on disk; this copy was **rebuilt from the
page images captured when the manual was first read** (850×1100 px per page, image-only: not text-searchable). Replace it with the
original if you still have it.

Below: what the manual says about **ending a turn / a Campaign**, and how it compares with the TCG Arena implementation. Section numbers are the manual's.

## 1. Structure (§11)

- **Turn** = one player's go. Phases, in any order, **except Compra which is always last** and ends the turn: Preparação (free, any number of times), Assalto (once per turn), Combate (once per Campaign, exclusive: nothing else that turn, then the turn passes), Compra (once per turn).
- A turn ends when the player **passes**, finishes the **Compra** phase (even buying nothing) or resolves **Combate**.
- **Campanha** = Início → alternating turns → **trégua** (every player passes in sequence without acting; any action resets it) → Fim da Campanha (end-of-campaign abilities, influence scoring §15.3) → **Renovação** → next Campanha.
- **Primazia** (first player) alternates each Campanha. From the 2nd Campanha the starting player pays **+1** to buy from the **leftmost (newest) column** of the Mercado, only while it is their turn.

## 2. What happens at the end of a TURN (§10.3, §10.4)

- Between the end of your turn and the start of the next player's, you **must store** every leftover resource (and força token) **on your Melhorias**. **Anything not stored is discarded** (back to the general reserve).
  - Coloured Melhoria: only its own colour, unlimited. Neutral (grey) Melhoria: any one colour at a time (other colours are discarded), plus gold. Gold and força tokens fit any Melhoria.
  - Stored resources stay yours and can be spent on later turns/Campanhas. You may not move them between Melhorias.
  - Resources received during someone else's turn need not be stored until the end of **your own next** turn.
  - A Melhoria destroyed in an Assalto gives its stored resources to the attacker.
- No hand-size limit during a Campanha (§9.4); the hand is only fixed in the Renovação.

## 3. Renovação (§11.4) — end of the Campanha, "upkeep puro", players act simultaneously in any order

1. **Untap all Melhorias** (activated ones turn back to normal).
2. **Reset the Campanha's effects** ("durante a Campanha"; assault immunities end).
3. **Generate resources**: each Melhoria with a colonist (a worker allocated to it, §8.4) generates 1 resource of its colour.
4. **Hand to exactly 6**: draw from the Império if fewer, discard the excess to the Descanso if more. Império never reshuffles early: only when you must draw and it is empty, shuffle the Descanso into a new Império (§11.4 "regra estrita").
5. **Roll the Mercado conveyors**: each of the three rows runs **left → right**; the **newest card is on the left, the oldest on the right**. On a roll the rightmost card is destroyed, the others slide right, a new card appears on the left. All three rows roll in a Renovação. An empty pile just means no cards of that type.

## 4. Buying (§9) — relevant to the Mercado shortcuts

- One purchase per turn (plus the *compra plena* bonus). Pay with resource tokens; at least one must be the card's colour (neutral cards: any).
- The bought card leaves the Mercado, the row closes up and a new card is revealed at once, then:
  - **Estratégia / Melhoria → your hand.**
  - **Combatente → the BOTTOM of your Império** (the **TOP** if it was a *compra plena*: paid entirely with its own colour and/or gold; cost-0 cards never are).
  - *Compra plena* of an Estratégia/Melhoria also grants a second purchase of the same type and equal or lower cost.
- Capitals enter play at setup **with one resource token of their colour on them** (§7.1, step 9). For the first game the manual suggests revealing only the 4 Melhorias.

## 5. Gaps between the manual and the current game (not fixed yet)

| Manual | Current implementation | Gap |
|---|---|---|
| End of turn: unstored resources are discarded | Reserva counters (Roxo…Ouro) never reset | Needs a reset at end of turn (button or `onNewTurn`); decide how "stored on Melhorias" is represented (the 7 `draggableTokens` already exist on cards). |
| Combatente bought → bottom of Império (top if plena) | All three rows' shortcut moves to **Hand** | Wrong for Combatentes. Engine supports `actionData: {destination: "Deck", position: "BOTTOM"}` but `Deck` is in the default `tokenForbiddenSections`/`ownerOnlySections` (Mercado cards are tokens). |
| Mercado rows run left→right, newest left, oldest destroyed on the right | `advanceMarket()` discards `cards[row][last]`; new cards come from `drawFromExtraDeck(..., revealed)` | **Unverified** which on-screen end is "newest" — check before trusting Renovação. |
| Renovação: untap Melhorias, hand to 6, generate colonist resources | Only the Mercado roll is automated; hand/untap/colonists are manual | Hand-to-6 and untap are scriptable per player; colonist income needs a representation of "worker allocated to a Melhoria". |
| Capital starts with a resource token on it | Capital placed with no token | Add manually, or script it. |
| Primazia alternates each Campanha; +1 on the leftmost column for the first player | Primazia token is manual; no surcharge handling | Manual reminder only. |
| Trégua | Manual | — |
