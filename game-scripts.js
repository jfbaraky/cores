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

// Draws each revealed row back up to 4 (shortfall computed from the snapshot of `cards`).
async function fillMarket() {
  for (const { pile, revealed } of MARKET_PILES) {
    const short = MARKET_REVEALED_SIZE - (cards?.[revealed] ?? []).length;
    if (short > 0) await functions.drawFromExtraDeck(pile, short, false, revealed);
  }
}

// Self-healing refill, run by the Reserva's onCardsUpdate (fires ~500 ms after the last card
// change, so its snapshot is settled): buying a card, Renovação and a row that was reverted at
// start-up (seen with 2 players: the first row's reveal was overwritten) all end up topped up
// exactly once. Per-row onCardsLeave events were dropped because each used a stale snapshot of
// the other rows and over-drew. Does nothing until the market has been opened once.
async function keepMarketFull() {
  if (!game.isHost) return;
  // A cancelled purchase puts the token back after the row was already refilled: send the newest
  // (rightmost) extra card back to the top of its pile.
  for (const { pile, revealed } of MARKET_PILES) {
    const shown = cards?.[revealed] ?? [];
    if (shown.length > MARKET_REVEALED_SIZE) {
      const newest = [...shown].sort((a, b) => b.position.index - a.position.index)[0];
      await functions.moveCard(newest, pile);
    }
  }
  if (MARKET_PILES.every(({ revealed }) => (cards?.[revealed] ?? []).length === 0)) return;
  await fillMarket();
}

// Shuffles each pile and reveals the first 4. No-op once any row already has cards.
async function setupMarket() {
  if (!game.isHost) return;
  if (MARKET_PILES.some(({ revealed }) => (cards?.[revealed] ?? []).length > 0)) return;
  for (const { pile } of MARKET_PILES) await functions.shuffleSection(pile);
  await fillMarket();
}

// Renovação: the oldest revealed card of each row goes to its discard; keepMarketFull then refills
// the rows (fillMarket is not called here to avoid a double refill). New cards are appended on the
// RIGHT of a row, so the oldest is the LEFTMOST (the manual's conveyor runs the other way round).
async function advanceMarket() {
  for (const { revealed, discard } of MARKET_PILES) {
    const shown = cards?.[revealed] ?? [];
    if (shown.length === 0) continue;
    const oldest = [...shown].sort((a, b) => a.position.index - b.position.index)[0];
    await functions.moveCard(oldest, discard);
    functions.chatLog(`${functions.getCardData(oldest)?.name?.name ?? "Carta"} descartada do Mercado (Renovação).`);
  }
}

// --- Fim do turno e Renovação (manual §10.3, §11.4) ---------------------------
const RESOURCE_KEYS = ["roxo", "vermelho", "azul", "verde", "ouro"];

// Reserva.onNewTurn: runs on every client at every turn change. §10.3: resources not stored on
// Melhorias are discarded when *your* turn ends. Verified live (2 players, 12 turn changes): inside
// this handler `game.turn.isMyTurn` still describes the turn that has just ENDED (the snapshot is
// taken before the engine switches turn), so `true` here means "my turn just ended".
function endOfTurnCleanup() {
  if (!game.turn.isMyTurn) return;
  const reserva = game.data.Reserva;
  reserva.bonus = "";
  const lost = RESOURCE_KEYS.filter((k) => reserva[k] > 0).map((k) => `${reserva[k]} ${k}`);
  RESOURCE_KEYS.forEach((k) => { reserva[k] = 0; });
  if (lost.length > 0) {
    functions.chatLog(`Fim do turno: reserva descartada (${lost.join(", ")}). Só ficam os recursos armazenados nas Melhorias.`);
  }
}

// Draws `count` cards. §11.4: the Império is only rebuilt at the moment you must draw from an empty
// one, by shuffling the Descanso into it.
async function drawWithReshuffle(count) {
  const inDeck = (await functions.getDeck()).length;
  const first = Math.min(count, inDeck);
  if (first > 0) await functions.draw(first);
  const missing = count - first;
  if (missing <= 0) return;
  const discarded = cards?.Discard ?? [];
  if (discarded.length === 0) return;
  for (const card of discarded) await functions.moveCard(card, "Deck");
  await functions.shuffleSection("Deck");
  await functions.draw(Math.min(missing, discarded.length));
  functions.chatLog("Império esgotado: Descanso embaralhado para formar o novo Império.");
}

// "Renovação (minha parte)": each player runs this once per Renovação. Untaps the Território and
// brings the hand to exactly 6 (draws if short; the player chooses what to discard if over).
// Colonist income and the Mercado roll are separate (the latter is advanceMarket, once per table).
async function renovacao() {
  const tapped = (cards?.Territorio ?? []).filter((c) => c.isTapped);
  if (tapped.length > 0) await functions.updateCards(tapped, { isTapped: false });
  const hand = (cards?.Hand ?? []).length;
  if (hand < 6) await drawWithReshuffle(6 - hand);
  else if (hand > 6) functions.chatLog(`Renovação: descarte ${hand - 6} carta(s) da mão para o Descanso (a mão deve ter 6).`);
  functions.chatLog("Renovação: Melhorias desviradas, mão ajustada.");
}

// --- Trabalhar automático (manual §8.1) ------------------------------------------
// Descanso.onCardsEnter: every Trabalhador that arrives from the Mão (the click-to-play "Trabalhar")
// adds 1 resource of its colour to the Reserva. `transitionCards` holds the cards as they were before
// moving, so `position.section` is where they came from. Comerciar (2 workers -> 1 gold) is still
// manual: take the 2 colours back off and add 1 Ouro.
const WORKER_COLOR = {
  "trabalhador-helenica": "roxo",
  "trabalhador-latina": "vermelho",
  "trabalhador-fenicia": "azul",
  "trabalhador-celta": "verde",
};

function trabalhar() {
  const gained = [];
  for (const card of transitionCards ?? []) {
    if (card.position?.section !== "Hand") continue;
    const color = WORKER_COLOR[card.cardData?.id];
    if (!color) continue;
    game.data.Reserva[color] += 1;
    gained.push(color);
  }
  if (gained.length > 0) functions.chatLog(`Trabalhar: +1 ${gained.join(", +1 ")}`);
}

// --- Compra normal / compra plena (manual §9.2, §9.3) ---------------------------------
// The corner shortcut of a Mercado card moves it to the Mão. Hand.onCardsEnter then runs
// comprarCarta(), which opens the "Compra" modal (a custom section rendered only for the buying
// player, game.data.Compra) asking: Compra plena / Compra normal / Cancelar. The choice runs
// concluirCompra(modo) or cancelarCompra().
//  - Combatente: the Mercado token is swapped for a real card (a token that enters the Império does
//    not survive being drawn). Normal: the real card is created in the Descanso (joins the Império
//    at the next reshuffle, approximating "fundo"). Plena: created in the Descanso, then moved to
//    the top of the Império.
//  - Estratégia / Melhoria: the card stays in the Mão; a plena purchase shows the second-purchase
//    right ("2ª compra: mesmo tipo, custo ≤ N") in the Reserva until the turn ends.
// The payment itself (counters) stays manual: the choice is the player's declaration, logged for both.
const MARKET_ROW_TYPE = {
  MercadoCombatentesRevelado: "Combatente",
  MercadoEstrategiasRevelado: "Estratégia",
  MercadoMelhoriasRevelado: "Melhoria",
};

function comprarCarta() {
  for (const bought of transitionCards ?? []) {
    const type = MARKET_ROW_TYPE[bought.position?.section];
    if (!type) continue;
    const data = bought.cardData;
    Object.assign(game.data.Compra, {
      open: true,
      id: bought.id,
      cardId: data?.id ?? "",
      row: bought.position.section,
      type,
      name: data?.face?.front?.name?.name ?? type,
      cost: data?.cost ?? data?.face?.front?.cost ?? 0,
      hint:
        type === "Combatente"
          ? "Plena: vai para o topo do Império. Normal: vai para o Descanso e entra no próximo Império."
          : "Plena: dá direito a uma 2ª compra do mesmo tipo, custo igual ou menor. Normal: sem bônus.",
    });
    return;
  }
}

async function concluirCompra(modo) {
  const compra = game.data.Compra;
  const plena = modo === "plena";
  if (compra.type === "Combatente") {
    const token = (cards?.Hand ?? []).find((c) => c.id === compra.id);
    if (token) await functions.moveCard(token, "Remove");
    // createCard returns nothing movable and `cards` is a snapshot, so a plena Combatente is
    // flagged here and moved to the top of the Império by subirParaTopo() once the new card
    // shows up in the Descanso's own onCardsEnter event (fresh snapshot).
    if (plena) compra.topo = compra.cardId;
    await functions.createCard(compra.cardId, "Discard");
  }
  functions.chatLog(
    plena
      ? `Compra plena: ${compra.name} (custo ${compra.cost})${compra.type === "Combatente" ? " vai para o topo do Império." : ". Direito a uma 2ª compra do mesmo tipo, custo ≤ " + compra.cost + "."}`
      : `Compra normal: ${compra.name} (custo ${compra.cost})${compra.type === "Combatente" ? " vai para o Descanso e entra no próximo Império." : "."}`,
  );
  game.data.Reserva.bonus = plena && compra.type !== "Combatente" ? `2ª compra: ${compra.type}, custo ≤ ${compra.cost}` : "";
  compra.open = false;
}

async function subirParaTopo() {
  const compra = game.data.Compra;
  if (!compra.topo) return;
  const card = (cards?.Discard ?? []).find((c) => c.cardData?.id === compra.topo && !c.isToken);
  if (!card) return;
  compra.topo = "";
  await functions.moveCard(card, "Deck");
}

async function cancelarCompra() {
  const compra = game.data.Compra;
  const token = (cards?.Hand ?? []).find((c) => c.id === compra.id);
  if (token) await functions.moveCard(token, compra.row);
  functions.chatLog(`Compra cancelada: ${compra.name} voltou ao Mercado.`);
  compra.open = false;
}
