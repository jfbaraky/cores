// Cores da Guerra — TCG Arena custom scripts
// Loaded via gamefile.json's top-level "scriptsUrls" array. Functions here are
// called by short one-line references from a custom section's "events" (e.g.
// Reserva's events below) — keep the JSON inline scripts short, put real
// logic here.

// §7.1 of the manual: the Capital enters play immediately, on Território, at
// no cost — it's never part of the drawable deck. Two platform constraints,
// both confirmed by live 2-player testing, shaped this function:
//   1. cards.Deck returns nothing to scripts while that section is
//      isHidden:"yes" — hidden zones aren't readable even by their own
//      owner's scripts, so we can't just inspect the deck for the Capital.
//   2. beforeGameStart.boardCategoriesInSideboard (which docs describe as
//      routing a deck category to the Sideboard zone before board setup
//      runs) turned out to be a dead end for a *preconstructed* deck: live
//      testing showed the "swap with your sideboard" screen still listing
//      the Capital inside Deck (13) with Sideboard staying at 0, both with
//      the sideboard step enabled and with the host's "disable sideboard"
//      toggle on. Nothing routes it out of the deck ahead of time.
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
// Either way, after pulling the Capital out onto Território, top the hand
// back up to exactly startingHandSize (6): draw more if the Capital was one
// of the original 6 (leaving only 5 real cards), or return the extra
// Trabalhadores drawn while searching back to Deck and reshuffle if the
// search overshot 6.
//
// Guarded at the top by checking Território for an existing Capital, so
// this is idempotent and safe to call from every event listed in
// gamefile.json (onPlayersSideboardClosed, onPlayersMulligan,
// onPlayersReady, onNewTurn, onCardsUpdate) without redrawing the deck on
// later turns once the Capital is already in play.
const CAPITAL_SEARCH_DRAW = 7; // 13-card Império - 6-card starting hand
const STARTING_HAND_SIZE = 6;

async function placeCapital() {
  const territorio = cards?.Territorio ?? [];
  if (territorio.some((c) => functions.getCardData(c)?.type === "Capital")) {
    return; // already placed — nothing to do
  }

  let hand = cards?.Hand ?? [];
  let capital = hand.find((c) => functions.getCardData(c)?.type === "Capital");

  if (!capital) {
    await functions.draw(CAPITAL_SEARCH_DRAW);
    hand = cards?.Hand ?? [];
    capital = hand.find((c) => functions.getCardData(c)?.type === "Capital");
  }

  if (!capital) return; // not this player's setup instant yet

  const data = functions.getCardData(capital);
  await functions.moveCard(capital, "Territorio");
  functions.chatLog(`${data?.name?.name ?? "Capital"} colocada em jogo automaticamente no Território.`);

  const remaining = (cards?.Hand ?? []).length;
  if (remaining < STARTING_HAND_SIZE) {
    await functions.draw(STARTING_HAND_SIZE - remaining);
  } else if (remaining > STARTING_HAND_SIZE) {
    const rest = cards?.Hand ?? [];
    const toReturn = rest.slice(0, remaining - STARTING_HAND_SIZE);
    await functions.moveCards(toReturn, "Deck");
    await functions.shuffleSection("Deck");
  }
}
