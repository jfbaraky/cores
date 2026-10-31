# Realistic-play test checklist — Cores da Guerra on TCG Arena

Built from the original manual (`docs/manual/cores-da-guerra-manual-v1.pdf`, "Versão de Trabalho v1"; § numbers below are the manual's).
A test run only counts if **every turn follows the rules below**, cards are **used for what they say**, and the two screens
are compared after each step. Two players, two browsers (host = Chrome, guest = built-in pane), nobody looks at the other's hand.

## 0. Why this exists — what the first re-test run got wrong

| What I did | What the rules say |
|---|---|
| Every Campanha was one action turn per player, then four passes. | A Campanha runs **until the trégua** (§11.2–11.3): turns alternate while anyone still has something worth doing; any action resets the trégua. Several turns per Campanha is normal once Impérios grow. |
| Dumped the whole hand as workers, bought one card, passed. | Workers have four jobs (§8): trabalhar, **comerciar**, **milícia**, **colonizar**. Choosing between them is the economy. |
| Played Melhorias and never used them. | A Melhoria's text is the point of buying it: fixed effects apply, **activated ones are tapped for their effect** (§12.1). Each purchase must be justified by using it. |
| Kept a Combatente in hand for several Campanhas; no Estratégia ever. | Combatentes exist to fight (Assalto §14.2, Combate §14.3); Estratégias are played from the hand and use the Pilha (§13). |
| Let leftover resources vanish. | At the end of every turn you must **store** leftovers on your Melhorias (§10.3). Spend stored resources **before** hand-generated ones. |
| Ignored the +1 surcharge, plena second purchase, muralhas, força tokens, colonos. | See §3 and §6 below. |
| "Drew too many cards" (reported by the user). | I found no over-draw in the hand counts (6, or 7 with the Helênica bonus), but I did not track Império/Descanso totals. §2 makes that accounting mandatory so any over-draw is caught the moment it happens. |

## 1. Setup checks (once)

- [ ] 12 cards per player: 3 Trabalhadores of **each** civilization (§7); 6 in hand, 6 in the Império; the Capital is on the Território **with 1 resource token of its colour** (§7.1 step 9 — gap, see §7).
- [ ] Mercado: 3 rows × 4 revealed; piles 53/69/70 after reveal (total 204 − 12 in the rows); rows identical on both screens (§7 step 3).
- [ ] Primazia: first player decided; **the first Campanha has no +1 surcharge** (§11.2).
- [ ] Both players can see their own hand only; opponent hand shows card backs.

## 2. Every turn — card accounting (do this before and after each step)

Keep a one-line log per step: `Mão / Império / Descanso / Território / Campo / Desterro` for **both** players.

- [ ] **Conservation:** (Mão + Império + Descanso + Território + Campo) of a player = 12 + cards bought − cards destroyed (Desterro). Capital included.
- [ ] **Draws happen only** (a) in the Renovação (hand to **exactly 6**, 7 with the Helênica bonus, §11.4/§15.3) or (b) by a card/ability that says "saque" (§5). Any other change of the Mão upward is a bug.
- [ ] **Hand is never trimmed during a Campanha** (§9.4); only at the Renovação (discard the excess to the Descanso).
- [ ] Império never reshuffles early: the Descanso is shuffled **only at the moment you must draw from an empty Império** (§11.4) — and the chat says so once.
- [ ] Spent Estratégias/Combatentes/workers are in the **Descanso**, not lost (§13.3, §14.2).

## 3. Turn checklist (in the order a real turn happens)

### A. Start of the turn
- [ ] It is the right player's turn on both screens; primazia alternates every Campanha (§11.2).
- [ ] From the **2nd Campanha**, the player who started the Campanha pays **+1 resource** for any card in the Mercado column where cards appear (the *newest* column), **only on their own turn** (§11.2).
- [ ] Stored resources (tokens on Melhorias) and unspent hand resources are known; spend **stored first** (§10.3).

### B. Preparação (free, any number of times, in any order with the other phases — §11.1)
- [ ] **Trabalhar** (§8.1): each worker discarded = +1 token of **its** colour (Helênico roxo, Latino vermelho, Fenício azul, Celta verde). Counter and chat agree on both screens.
- [ ] **Comerciar** (§8.2): any 2 workers = 1 **ouro** (script does not do this; counters by hand, chat the declaration).
- [ ] **Milícia** (§8.3): força token on a worker in hand = defence 1, **defence only**, not a Combatente, goes to the Descanso after the Conflito.
- [ ] **Colonizar** (§8.4): worker onto an **eligible** Melhoria (same colour, no own generation, no other colono). Permanent. Generates 1 resource of the Melhoria's colour **in the Renovação**.
- [ ] **Ativar Melhorias** (§12.1): tap (90°) → effect once per Campanha → stays tapped until the Renovação. The effect is actually applied (draw, resource, etc.) and chatted.
- [ ] **Construir muralha** (§12.4): pay 2 any resources → muralha token on one Melhoria (max 1 per Melhoria).
- [ ] **Estratégias** (§13): declared before use, goes on the Pilha, opponent may answer **only with an Estratégia**; resolves top-down, then → Descanso (lasting effects stay on the table until they end).
- [ ] Fixed Melhorias (§12.1): their static effect is respected when it applies (reducers count for plena, §9.3).

### C. Assalto (once per turn, §14.2) — only if you have Combatentes
- [ ] Declare; the opponent may respond (Estratégias only). Pick targets; **declaring a target makes it immune this Campanha** if it survives.
- [ ] Cards face-down in front of each target; the defender matches too; nothing is revealed until resolution.
- [ ] Resolution is **step by step in all targets**: 1E in all, then 2E (cavalry; **cavalry cannot enter against a muralha**).
- [ ] Damage = difference of totals (força + effects + força tokens, defender +1 if muralha). **Tie = defender wins**; muralha is discarded on a tie.
- [ ] Damage 1 → Melhoria **discarded** (Descanso of its owner); 2+ → **destroyed** (Desterro; a Capital goes to its owner's Descanso instead, §7.2). **No Hegemonia.**
- [ ] Looting: the attacker takes **all resources/tokens stored on that Melhoria**; the colono's fate is the attacker's choice (perdoar / destruir / capturar, §14.2).
- [ ] Afterwards all participating cards except Melhorias → **Descanso of their owners**; força tokens back to the reserve.

### D. Combate / Batalha Campal (once per Campanha, **exclusive**: nothing else this turn, the turn ends, §11.1, §14.3)
- [ ] Attacker pays **1 resource**; declares; the opponent may answer with an Estratégia.
- [ ] 1E: attacker then defender place cards face-down (força tokens only attachable now), reveal, then **one green ability per turn** alternately until both pass. [REAÇÃO] never nests.
- [ ] Formação: ≥ 2 médios/pesados of the **same civilization** → +1 força each (1E only); ligeiros never; units in a formation cannot use abilities.
- [ ] 2E: only cavalry enters; damage computed at the end of 2E.
- [ ] **Only the attacker scores**, and only the **difference**; tie or defender win = 0. Points are immediate; **12 wins at once**.
- [ ] Defender may **flee**: points halved **rounded up**; then Perseguição (each cavalry destroys one fugitive → Desterro), **extra Assalto ignoring immunity**, remaining fugitives → Descanso.
- [ ] All Combatentes → Descanso of their owners; turn passes.

### E. Compra (always last; once per turn; the turn ends even if you buy nothing — §9.1, §11.1)
- [ ] Payment: **≥ 1 token of the card's colour**, rest any colour or ouro; neutral (grey) cards any colours (§9.2). Counters (or stored tokens) are reduced by hand — nobody gets a card for free.
- [ ] The card leaves the row, the row **closes up and a new card is revealed immediately** (§9.2, §11.4) on both screens; pile −1.
- [ ] Estratégia/Melhoria → hand. **Combatente → BOTTOM of the Império** (TOP if plena) (§9.2/§9.3).
- [ ] **Plena** (§9.3): whole cost paid in the card's own colour and/or ouro (cost 0 never plena; reducers count). Combatente → top of the Império; Estratégia/Melhoria → **one second purchase**, same type, cost ≤ first, normal cost, **no second plena bonus**.
- [ ] Cancel returns the card to the same slot, owned by nobody, the row is unchanged.

### F. End of the turn (pass, finishing Compra, or resolving a Combate — §11.1)
- [ ] Every leftover resource/força token is **stored on a Melhoria**: coloured Melhoria = its own colour only; neutral Melhoria = **one** colour at a time (+ ouro); ouro/força fit any (§10.3). The rest is discarded — the chat says what was lost, **on the turn's last step**, not at the start of the next turn.
- [ ] Resources received on the opponent's turn stay in the reserve until the end of **your own next turn**.
- [ ] Pass: the turn changes on both screens.

## 4. Every Campanha

- [ ] **Início:** "início da Campanha" abilities (§11.2). First player = alternates each Campanha.
- [ ] **Turns until trégua:** keep playing real turns while any player still has useful actions. The trégua is **all players passing in sequence with no action**; any action restarts it (§11.3). A player with no legal action must pass.
- [ ] **Final da Campanha** (§15.3, in this order): 1) "fim da Campanha" abilities; 2) influence points: Civilização 3/5/7 Melhorias of one civilization = 1/2/3 (Capital counts, neutral excluded, tapped or not), Política = 4 colours = +1; 3) victory check (12 Hegemonia, or Influência Total = ≥ 3 Melhorias in each of the 4 civilizations **ever**).
- [ ] **Bonuses queued for the Renovação:** Fenícia +1 ouro · Latina muralha **or** força token · Helênica draw +1 (hand 7) · Celta destroy a card in the Mercado or in the own Descanso **during the next Campanha, on your turn**. Política: pick one bonus of a civilization **not** scored this Campanha.
- [ ] **Renovação** (§11.4, simultaneous): untap all Melhorias · "durante a Campanha" effects and assalto immunities end · **colonos generate 1 resource each** (store it!) · hand to exactly 6 (7 Helênica) · **all three Mercado rows roll**: the rightmost (oldest) card is destroyed, the rest slide right, a new card appears on the **left**.
- [ ] Mercado pile exhausted → that type simply is not available; piles never reshuffle.
- [ ] After 12 Campanhas without a winner: most Hegemonia wins (§15.4). 12 reached by both at the same Final de Campanha → keep playing (§15.5).

## 5. Use the cards (each Campanha, both players)

Before buying or playing, read the card text in `cards.json` (`abilityText`, `subtype`, `activationType`, `strength`, `weightClass`, `isCavalry`, keywords). Then:

- [ ] Every Melhoria in the Território is **used at least once** in the test (fixed effect observed or activated and applied).
- [ ] Every Estratégia bought is **played** (with at least one answered on the Pilha during the whole test).
- [ ] Every Combatente bought is **played in a Conflito**; at least one Assalto and one Combate per player, with ligeiro/médio/pesado, one formação, one cavalry, one força token, one muralha.
- [ ] Capital abilities used (Pella: look at the Império top, Helênica → hand, otherwise back).
- [ ] Draw effects (e.g. Ágora Helenística "compra limpa", Memorial de Guerra) change the hand **and** the Império/Descanso totals accordingly.

## 6. Coverage matrix — must each happen at least once in a full test

Economy: trabalhar · comerciar · colonizar + Renovação income · milícia · stored tokens spent on a purchase · resources lost at end of turn · ouro paying a plena.
Compra: normal · plena Combatente (top) · normal Combatente (bottom) · plena Estratégia/Melhoria + second purchase · neutral card · cancel · +1 surcharge · both players buy from the same row · pile exhausted.
Turns: several turns in one Campanha · trégua reset by an action · Combate ending the turn · obligatory pass.
Conflito: Assalto success (1 dano, 2+ dano) · Assalto defended (immunity) · muralha vs cavalry · saque with colono (each of the three fates) · Combate scored · fuga (halved, rounded up) · perseguição · assalto extra.
Score: Civilização 1/2/3 · Política · each of the 4 bonuses · Influência Total · 12 by Combate (mid-Campanha) · 12 by influence · 12-Campanha limit.
Zones: Descanso reshuffle · Desterro · Capital destroyed → Descanso · Império top/bottom insertions.

## 7. Known gaps between the manual and the TCG Arena implementation (the tester does these by hand and chats the declaration)

| Rule | State |
|---|---|
| Capital starts with 1 resource token (§7.1) | not placed automatically |
| Mercado conveyor: newest **left**, oldest **right** destroyed (§11.4) | **inverted**: new cards go on the right and the leftmost (oldest) is destroyed — the "newest column" for the +1 surcharge is therefore the **right** one on screen |
| +1 surcharge for the first player from Campanha 2 (§11.2) | not implemented; manual |
| Combatente normal → bottom of the Império (§9.2) | goes to the Descanso (scripts cannot insert at the bottom) |
| Storing resources on Melhorias (§10.3) | by dragging tokens onto cards; counters reset at the end of the turn; spending stored tokens is manual |
| Colonos / generation in the Renovação (§8.4) | not represented; worker on a Melhoria + manual resource at the Renovação |
| Comerciar, milícia, muralha, força tokens, Conflitos, Pilha, ability effects | manual (declared in chat) |
| Plena detection, payment validity (colour rule) | manual declaration; the modal only records the choice |
| Primazia alternation | by pass order; no token movement automation |
| End of turn cleanup timing | **bug found on 2026-10-30:** the discard ran at the start of your *next* turn since the platform update (fixed in `game-scripts.js`, not yet published) |

## 8. Both-screens feedback checklist (after each step)

- [ ] Same Mercado rows (ids and order), same pile counts, same discards.
- [ ] Opponent's counters, Território, Campo, Descanso size and Hegemonia equal what its owner sees.
- [ ] The chat line for the step exists, names the right player, and **hides** hidden information (top card of the Império, face-down cards) from the other screen.
- [ ] No duplicated chat lines other than the known "Hegemonia agora" double (engine) and no console errors from game code.

## 9. Turn log template

```
C<campanha>.T<turno> <player> | start: hand/Imp/Desc | work: +<resources> | stored: <Melhoria:tokens> | buy: <card> (<plena/normal>, paid <tokens>) | cards used: <list> | conflict: <none/Assalto/Combate> | end: hand/Imp/Desc, lost: <tokens> | other screen agrees: y/n
```
