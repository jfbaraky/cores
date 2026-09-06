// Cores da Guerra — TCG Arena custom scripts
// Loaded via gamefile.json's top-level "scriptsUrls" array. Functions here are
// called by short one-line references from a custom section's "events" (e.g.
// Reserva's onPlayersMulligan/onCardsUpdate below) — keep the JSON inline
// scripts short, put real logic here.

// §7.1 of the manual: the Capital enters play immediately, on Território, at
// no cost — it's never part of the drawable deck. In this implementation it's
// still shuffled into each player's 13-card Império for deckbuilding purposes
// (Format is match-wide, not per-player, so there's no way to place a
// specific civ's Capital before deck choice is known). Confirmed live: a
// section's `cards` object can only see zones visible to their owner — the
// Deck (isHidden:"yes") is invisible even to scripts while the Capital sits
// in it, so there's no way to guarantee turn-1 placement. Instead, this
// checks Hand on every mulligan/board update and auto-plays the Capital the
// moment it's actually drawn — mulligan or a later turn, no manual step ever
// needed. Idempotent: no-ops once the Capital is already on Território.
async function placeCapital() {
  const hand = cards?.Hand ?? [];
  for (const card of hand) {
    const data = functions.getCardData(card);
    if (data && data.type === "Capital") {
      await functions.moveCard(card, "Territorio");
      chatLog(`${data.name?.name ?? "Capital"} colocada em jogo automaticamente no Território.`);
      return;
    }
  }
}
