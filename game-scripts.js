// Cores da Guerra — TCG Arena scripts.
// Only native building blocks are used (see docs/TCGA-REFERENCE.md): functions.getDeck,
// moveCard, draw, drawFromExtraDeck, shuffleSection, chatLog and the cards/game globals.
// No module-level flags: scripts run in a sandbox and module state does not persist.
// Every function below is idempotent by construction (it inspects the board first).

const isCapital = (card) => functions.getCardData(card)?.type === "Capital";

// §7.1: the Capital enters play at no cost and is never part of the hand.
// Runs at onPlayersDeckPicked (deck is still whole and the hand not dealt yet, so the
// Capital is found in the deck and the opening hand stays 6 Trabalhadores) and again at
// onPlayersReady as a safety net (e.g. if the Capital was dealt into the hand).
async function placeCapital() {
  if ((cards?.Territorio ?? []).some(isCapital)) return;

  const inHand = (cards?.Hand ?? []).find(isCapital);
  const capital = inHand ?? (await functions.getDeck()).find(isCapital);
  if (!capital) return;

  await functions.moveCard(capital, "Territorio");
  functions.chatLog(`${functions.getCardData(capital)?.name?.name ?? "Capital"} colocada em jogo automaticamente no Território.`);
  if (inHand) await functions.draw(1); // keep the hand at its starting size
}

// --- Mercado -------------------------------------------------------------
// Each category has a hidden pile, a face-up row of 4 and a discard. The piles are shared
// (not per-player) sections, so only the host mutates them.
const MARKET_PILES = [
  { pile: "MercadoCombatentesPilha", revealed: "MercadoCombatentesRevelado", discard: "MercadoCombatentesDescarte" },
  { pile: "MercadoEstrategiasPilha", revealed: "MercadoEstrategiasRevelado", discard: "MercadoEstrategiasDescarte" },
  { pile: "MercadoMelhoriasPilha", revealed: "MercadoMelhoriasRevelado", discard: "MercadoMelhoriasDescarte" },
];
const MARKET_REVEALED_SIZE = 4;

// Tops every revealed row back up to 4. Called by the rows' own onCardsLeave event (so
// buying a card refills its slot), after setup, and by the "Repor Mercado" button.
async function replenishMarket() {
  if (!game.isHost) return;
  for (const { pile, revealed } of MARKET_PILES) {
    const short = MARKET_REVEALED_SIZE - (cards?.[revealed] ?? []).length;
    if (short > 0) await functions.drawFromExtraDeck(pile, short, false, revealed);
  }
}

// Shuffles each pile and reveals the first 4. No-op once any row already has cards.
async function setupMarket() {
  if (!game.isHost) return;
  if (MARKET_PILES.some(({ revealed }) => (cards?.[revealed] ?? []).length > 0)) return;
  for (const { pile } of MARKET_PILES) await functions.shuffleSection(pile);
  await replenishMarket();
}

// Renovação: the oldest revealed card of each row goes to its discard; the rows' onCardsLeave
// event then refills them (replenishMarket is not called here to avoid a double refill).
async function advanceMarket() {
  for (const { revealed, discard } of MARKET_PILES) {
    const shown = cards?.[revealed] ?? [];
    if (shown.length === 0) continue;
    const oldest = shown[shown.length - 1];
    await functions.moveCard(oldest, discard);
    functions.chatLog(`${functions.getCardData(oldest)?.name?.name ?? "Carta"} descartada do Mercado (Renovação).`);
  }
}
