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
// these can fire back-to-back at match start before the first call's
// moveCard has landed on `cards`, so a guard that only checks
// cards.Territorio isn't enough to stop duplicate concurrent runs (also
// confirmed live: the placement log line appeared 3 times for one match).
// inFlight is a plain module-level flag — this script file is loaded once
// per client session, so it persists across calls the way any top-level
// variable would.
const CAPITAL_SEARCH_DRAW = 7; // 13-card Império - 6-card starting hand
const STARTING_HAND_SIZE = 6;
let inFlight = false;

async function placeCapital() {
  if (inFlight) return;
  const territorio = cards?.Territorio ?? [];
  if (territorio.some((c) => functions.getCardData(c)?.type === "Capital")) {
    return; // already placed — nothing to do
  }

  inFlight = true;
  try {
    const dealtHand = cards?.Hand ?? [];
    let capital = dealtHand.find((c) => functions.getCardData(c)?.type === "Capital");
    let handAfterDraw = dealtHand;

    if (!capital) {
      await functions.draw(CAPITAL_SEARCH_DRAW);
      handAfterDraw = cards?.Hand ?? []; // fresh read: draw()'s new cards do land on `cards`
      capital = handAfterDraw.find((c) => functions.getCardData(c)?.type === "Capital");
    }

    if (!capital) return; // not this player's setup instant yet

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
    inFlight = false;
  }
}
