// Cores da Guerra — TCG Arena custom scripts
// Loaded via gamefile.json's top-level "scriptsUrls" array. Functions here are
// called by short one-line references from a custom section's "events" (e.g.
// Reserva's events below) — keep the JSON inline scripts short, put real
// logic here.

// §7.1 of the manual: the Capital enters play immediately, on Território, at
// no cost — it's never part of the drawable deck. Two things confirmed live:
//   1. cards.Deck returns nothing to scripts while that section is
//      isHidden:"yes" - hidden zones aren't readable even by their own
//      owner's scripts. Checking only Hand meant the Capital only got
//      auto-placed if it happened to be drawn into the opening hand.
//   2. gamefile.json's beforeGameStart.boardCategoriesInSideboard:["Capital"]
//      routes the deck's "Capital" category card into the Sideboard zone
//      before the match starts, instead of leaving it shuffled into Deck.
//      Sideboard is not isHidden:"yes" the way Deck is, so (unlike Deck) it
//      should be readable here - letting this run BEFORE the opening hand is
//      even drawn, guaranteeing the Capital is on Território turn 1 as the
//      manual requires, rather than only whenever it's eventually drawn.
// Checks Sideboard first (the expected/guaranteed location), Hand as a
// fallback (in case boardCategoriesInSideboard behaves differently than
// expected in some client version). Idempotent: no-ops once the Capital is
// already on Território. Called from several events (see gamefile.json) so
// it fires whichever one actually carries this player's setup instant.
async function placeCapital() {
  const zones = ["Sideboard", "Hand"];
  for (const zone of zones) {
    const list = cards?.[zone] ?? [];
    for (const card of list) {
      const data = functions.getCardData(card);
      if (data && data.type === "Capital") {
        await functions.moveCard(card, "Territorio");
        chatLog(`${data.name?.name ?? "Capital"} colocada em jogo automaticamente no Território.`);
        return;
      }
    }
  }
}
