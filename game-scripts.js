// Cores da Guerra — TCG Arena custom scripts
// Loaded via gamefile.json's top-level "scriptsUrls" array. Functions here are
// called by short one-line references from a custom section's "events" (e.g.
// Reserva's events below) — keep the JSON inline scripts short, put real
// logic here.

// §7.1 of the manual: the Capital enters play immediately, on Território, at
// no cost — it's never part of the drawable deck. Platform constraints,
// confirmed by live 2-player testing, shaped this function:
//   1. cards.Deck returns nothing to scripts while that section is
//      isHidden:"yes" — hidden zones aren't readable even by their own
//      owner's scripts, so we can't just inspect the deck for the Capital.
//   2. beforeGameStart.boardCategoriesInSideboard (docs: routes a deck
//      category to Sideboard before board setup runs) turned out to be a
//      dead end for a *preconstructed* deck: live testing (both with the
//      host's "disable sideboard" toggle on and off) showed the "swap with
//      your sideboard" screen still listing the Capital inside Deck (13)
//      with Sideboard staying at 0. Nothing routes it out ahead of time.
//   3. `cards.Hand` does not refresh within a single script invocation
//      after this script's own moveCard() calls — confirmed live: reading
//      cards.Hand again immediately after moveCard(capital, "Territorio")
//      still returned the pre-move array including the Capital itself,
//      which (in an earlier version of this function) got scooped up as
//      "excess" and shipped right back into the deck, undoing the
//      placement. (cards.Hand DOES pick up functions.draw()'s new cards
//      when re-read — the staleness is specific to moveCard's effect not
//      landing on `cards` synchronously.) So below, the post-move hand is
//      tracked with a local array, never by re-reading cards.Hand.
// So the deck is always the full 13-card Império (1 Capital + 12
// Trabalhadores), same as the physical decklist — this function has to find
// the Capital wherever the native deal put it and can't assume it's
// somewhere pre-staged.
//
// Since the Capital is genuinely inside the shuffled 13-card deck, it lands
// in the dealt 6-card opening hand only ~46% of the time (6/13). The other
// ~54% of the time it's still buried in Deck, which the game never redraws
// from afterwards (newTurn.drawPerTurn is 0) — so a Hand-only check would
// leave more than half of all games with no Capital in play at all. To
// guarantee it unconditionally:
//   - If the Capital is already in Hand, use it.
//   - Otherwise, draw the rest of the deck (at most 7 cards: 13 total - 6
//     already dealt) into Hand — functions.draw() can pull from Deck even
//     though the deck's *contents* aren't inspectable, so this reliably
//     surfaces the Capital.
// Either way, after pulling the Capital out onto Território, the hand is
// corrected back to exactly startingHandSize (6) using only local
// bookkeeping: draw more if the Capital was one of the original 6 (leaving
// only 5 real cards), or return the extra Trabalhadores drawn while
// searching back to Deck and reshuffle if the search overshot 6.
//
// Called from several events (see gamefile.json): onPlayersSideboardClosed,
// onPlayersMulligan, onPlayersReady, onNewTurn, onCardsUpdate — several of
// these can fire back-to-back at match start before the first call's own
// mutations have landed on `cards`, so a guard that re-reads cards.Territorio
// isn't enough to stop duplicate runs: that read can itself be stale and
// still report "empty" after the Capital has already been placed (also
// confirmed live: with only that check, the placement log line appeared 3
// times, and a Market-side version of the same guard shape caused a single
// setup to redundantly re-run and over-draw the deck by a multiple of the
// intended amount — see setupMarket()). Two flags handle this:
// capitalInFlight is a short-lived re-entrancy guard for the async window
// while we search for the card (reset in `finally`, so a genuinely failed
// attempt can retry later); capitalPlaced is only claimed once we've
// actually found the Capital and committed to moving it, and — unlike
// capitalInFlight — is NEVER reset, so it can't be defeated by a stale
// `cards.Territorio` read the way a check-and-reset guard can.
const CAPITAL_SEARCH_DRAW = 7; // 13-card Império - 6-card starting hand
const STARTING_HAND_SIZE = 6;
let capitalPlaced = false;
let capitalInFlight = false;

async function placeCapital() {
  if (capitalPlaced || capitalInFlight) return;
  const territorio = cards?.Territorio ?? [];
  if (territorio.some((c) => functions.getCardData(c)?.type === "Capital")) {
    capitalPlaced = true;
    return; // already placed — nothing to do
  }

  capitalInFlight = true;
  try {
    const dealtHand = cards?.Hand ?? [];
    let capital = dealtHand.find((c) => functions.getCardData(c)?.type === "Capital");
    let handAfterDraw = dealtHand;

    if (!capital) {
      await functions.draw(CAPITAL_SEARCH_DRAW);
      handAfterDraw = cards?.Hand ?? []; // fresh read: draw()'s new cards do land on `cards`
      capital = handAfterDraw.find((c) => functions.getCardData(c)?.type === "Capital");
    }

    if (!capital) return; // not this player's setup instant yet — capitalInFlight resets below, can retry

    capitalPlaced = true; // committed — see comment above
    const data = functions.getCardData(capital);
    const handWithoutCapital = handAfterDraw.filter((c) => c !== capital);

    await functions.moveCard(capital, "Territorio");
    functions.chatLog(`${data?.name?.name ?? "Capital"} colocada em jogo automaticamente no Território.`);

    const size = handWithoutCapital.length;
    if (size < STARTING_HAND_SIZE) {
      await functions.draw(STARTING_HAND_SIZE - size);
    } else if (size > STARTING_HAND_SIZE) {
      const toReturn = handWithoutCapital.slice(0, size - STARTING_HAND_SIZE);
      await functions.moveCards(toReturn, "Deck");
      await functions.shuffleSection("Deck");
    }
  } finally {
    capitalInFlight = false;
  }
}

// --- Mercado (Market) automation ---------------------------------------
//
// §8 of the manual: each of the 3 Mercado piles (Combatentes/Estratégias/
// Melhorias) keeps a hidden shuffled pile with 4 face-up "revealed" slots
// players buy from — the "esteira" (conveyor). Two platform-specific
// mechanisms make this scriptable at all:
//   - functions.drawFromExtraDeck(sectionName, count, fromBottom,
//     forceDestination) can pull from ANY named deck-like section, unlike
//     functions.draw() which is hardcoded to the player's own "Deck". The
//     Mercado piles are shared (not per-player) and isHidden:"yes" — same
//     as Território's Deck, their contents aren't inspectable via `cards`,
//     so this is the only way to move cards out of them at all.
//   - There's no native "end of Campaign/Renovação" event to hook into, so
//     advancing the esteira (discard the oldest revealed card, reveal a
//     new one) is wired to a manual button in the Reserva panel
//     ("Avançar Mercado (Renovação)") rather than an automatic trigger —
//     same category of manual step as passing the Primazia token.
//
// "Oldest" is approximated as the last element of each Revelado array
// (cards.SectionName order), matching the physical esteira's convention of
// new cards entering on one side and aging toward the other; not verified
// against the manual's exact card ordering since script arrays don't carry
// an explicit timestamp.
//
// setupMarket() originally guarded itself the same way the first version of
// placeCapital() did — re-reading cards.Revelado to check "is this already
// done" — and hit the exact same staleness bug, live: with 3 setup events
// firing close together, that read kept reporting 0 revealed cards even
// after an earlier run had already filled them, so the shuffle+reveal-4
// sequence re-ran multiple times per pile. Confirmed live: the piles came
// up 45/65/58 remaining instead of 53/69/70 — each short by an exact
// multiple of 4 (12, 8, 16), matching 3/2/4 redundant full setup passes.
// Fixed the same way as capitalPlaced: a flag claimed synchronously, before
// any await, that's never reset — immune to `cards` staleness because it
// never depends on re-reading `cards` at all.
const MARKET_PILES = [
  { pile: "MercadoCombatentesPilha", revealed: "MercadoCombatentesRevelado", discard: "MercadoCombatentesDescarte" },
  { pile: "MercadoEstrategiasPilha", revealed: "MercadoEstrategiasRevelado", discard: "MercadoEstrategiasDescarte" },
  { pile: "MercadoMelhoriasPilha", revealed: "MercadoMelhoriasRevelado", discard: "MercadoMelhoriasDescarte" },
];
const MARKET_REVEALED_SIZE = 4;
let marketSetup = false;

// One-time setup: shuffle each hidden pile and reveal the first 4 cards.
async function setupMarket() {
  if (marketSetup) return;
  marketSetup = true; // claim before any await — see comment above
  for (const { pile } of MARKET_PILES) {
    await functions.shuffleSection(pile);
  }
  await replenishMarket();
}

// Tops up every Revelado row back up to MARKET_REVEALED_SIZE (4) by
// drawing from its hidden pile. Called after setup, after advanceMarket()'s
// discards, and once per onNewTurn (not onCardsUpdate: that fires on every
// single card move including this function's own draws, which — combined
// with the same `cards`-staleness risk noted above — caused a runaway
// redraw loop live; onNewTurn is much lower-frequency, so a bought card's
// slot gets refilled by the start of the next turn rather than instantly,
// which is a safe tradeoff here). Not further guarded against re-entrancy:
// unlike setup, this legitimately needs to re-run many times over a game,
// and each pile's own `short` computation is a plain clamped top-up, not a
// one-shot claim, so a redundant call just finds every pile already at 4
// and no-ops.
async function replenishMarket() {
  for (const { pile, revealed } of MARKET_PILES) {
    const short = MARKET_REVEALED_SIZE - (cards?.[revealed] ?? []).length;
    if (short > 0) {
      await functions.drawFromExtraDeck(pile, short, false, revealed);
    }
  }
}

// Manual "Avançar Mercado (Renovação)" button (Reserva panel): discards
// the oldest revealed card from each of the 3 piles to the matching
// Descarte zone, then replenishes all three back to 4.
async function advanceMarket() {
  for (const { revealed, discard } of MARKET_PILES) {
    const shown = cards?.[revealed] ?? [];
    if (shown.length > 0) {
      const oldest = shown[shown.length - 1];
      await functions.moveCard(oldest, discard);
      functions.chatLog(`${functions.getCardData(oldest)?.name?.name ?? "Carta"} descartada do Mercado (Renovação).`);
    }
  }
  await replenishMarket();
}
