// Cores da Guerra — TCG Arena scripts.
// Only native building blocks are used (see docs/TCGA-REFERENCE.md): moveCard,
// drawFromExtraDeck, shuffleSection, getDeck, chatLog and the cards/game globals.
// No module-level flags: scripts run in a sandbox and module state does not persist.
// Every function below is idempotent by construction (it inspects the board first).

// Diagnostics (see docs/DIAGNOSTICS.md): one log line with what the script sandbox sees.
// Runs from the DEBUG button in the Reserva panel; safe to call from anywhere.
async function debugBoard(tag) {
  const deck = await functions.getDeck();
  const types = (list) => (list ?? []).map((c) => functions.getCardData(c)?.type?.[0]).join("");
  functions.chatLog(
    `[debug ${tag ?? ""}] host=${game.isHost} hand=${(cards?.Hand ?? []).length}(${types(cards?.Hand)}) deck=${deck.length}(${types(deck)}) ` +
      `terr=${(cards?.Territorio ?? []).length}(${types(cards?.Territorio)}) descanso=${(cards?.Discard ?? []).length} ` +
      `rev=${MARKET_PILES.map(({ revealed }) => (cards?.[revealed] ?? []).length).join("/")} ` +
      `descartes=${MARKET_PILES.map(({ discard }) => (cards?.[discard] ?? []).length).join("/")}`,
  );
}

// The Capital needs no script: gamefile.json sets sections.categoriesAlreadyOnBoard to
// ["Capital->Territorio"], so the engine puts the deck's Capital category straight onto the
// Território and the 6-card opening hand is dealt from the 12 Trabalhadores.

// --- Mercado -------------------------------------------------------------
// Each category has a hidden pile, a face-up row of 4 and a discard. The piles are shared
// (not per-player) sections, so only the host mutates them.
const MARKET_PILES = [
  { pile: "MercadoCombatentesPilha", revealed: "MercadoCombatentesRevelado", discard: "MercadoCombatentesDescarte" },
  { pile: "MercadoEstrategiasPilha", revealed: "MercadoEstrategiasRevelado", discard: "MercadoEstrategiasDescarte" },
  { pile: "MercadoMelhoriasPilha", revealed: "MercadoMelhoriasRevelado", discard: "MercadoMelhoriasDescarte" },
];
const MARKET_REVEALED_SIZE = 4;

// Tops one revealed row back up to 4. Each row's own onCardsLeave event calls this for that row
// only: a row-wide refill from every event would use a stale snapshot of the other rows and
// over-draw (Renovação fired 3 events and left 6/6/6 revealed).
async function replenishRow(pile, revealed) {
  if (!game.isHost) return;
  const short = MARKET_REVEALED_SIZE - (cards?.[revealed] ?? []).length;
  if (short > 0) await functions.drawFromExtraDeck(pile, short, false, revealed);
}

// Tops every row up to 4 (setup and the "Repor Mercado" button).
async function replenishMarket() {
  for (const { pile, revealed } of MARKET_PILES) await replenishRow(pile, revealed);
}

// Shuffles each pile and reveals the first 4. No-op once any row already has cards.
async function setupMarket() {
  if (!game.isHost) return;
  if (MARKET_PILES.some(({ revealed }) => (cards?.[revealed] ?? []).length > 0)) return;
  for (const { pile } of MARKET_PILES) await functions.shuffleSection(pile);
  await replenishMarket();
}

// Renovação: the oldest revealed card of each row goes to its discard; the rows' onCardsLeave
// events then refill each row (replenishMarket is not called here to avoid a double refill).
async function advanceMarket() {
  for (const { revealed, discard } of MARKET_PILES) {
    const shown = cards?.[revealed] ?? [];
    if (shown.length === 0) continue;
    const oldest = shown[shown.length - 1];
    await functions.moveCard(oldest, discard);
    functions.chatLog(`${functions.getCardData(oldest)?.name?.name ?? "Carta"} descartada do Mercado (Renovação).`);
  }
}
