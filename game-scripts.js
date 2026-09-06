// Cores da Guerra — TCG Arena custom scripts
// Loaded via gamefile.json's top-level "scriptsUrls" array. Functions here are
// called by short one-line references from a custom section's "events" (e.g.
// Reserva's onPlayersDeckPicked below) — keep the JSON inline scripts short,
// put real logic here.

// §7.1 of the manual: the Capital enters play immediately, on Território, at
// no cost — it's never part of the drawable deck. Since it's shuffled into
// each player's 13-card Império for deckbuilding purposes (there's no way to
// vary a per-player card placement by which of the 4 starter decks a player
// picked, since Format is match-wide, not per-player), this pulls it back
// out automatically right after deck selection, before the mulligan
// shuffle-and-draw — so it never eats one of the 6 opening-hand slots.
async function placeCapital() {
  const zones = ["Deck", "Hand"];
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
  chatLog("Aviso: nenhuma Capital encontrada em Deck/Hand para colocar automaticamente.");
}
