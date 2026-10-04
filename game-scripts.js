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
  if (MARKET_PILES.every(({ revealed }) => (cards?.[revealed] ?? []).length === 0)) return;
  // A card waiting in the Compra modal keeps its row short until the buyer confirms (the flag is shared
  // state written by the buyer, who may be the guest). The pause gives the flag time to arrive: it is set
  // ~300 ms after the card moves, this event runs ~500 ms after the move.
  await sleep(700);
  if (game.data.MercadoEstado?.pendente) return;
  await fillMarket();
}

const sleep = (ms) => new Promise((resolve) => (typeof setTimeout === "function" ? setTimeout(resolve, ms) : resolve()));

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

// --- Final de Campanha: influência (manual §15.3) ------------------------------------
const CIVILIZATIONS = ["Fenícia", "Latina", "Helênica", "Celta"];

// Pure scoring from the number of Melhorias (Capital included, neutral ones excluded) per
// civilization: 3/5/7 of one civilization = 1/2/3 points; at least one of each of the four = 1 point.
function influenceScore(counts) {
  const scored = CIVILIZATIONS.filter((civ) => counts[civ] >= 3);
  const civPoints = scored.reduce((sum, civ) => sum + (counts[civ] >= 7 ? 3 : counts[civ] >= 5 ? 2 : 1), 0);
  const political = CIVILIZATIONS.every((civ) => counts[civ] >= 1);
  return { scored, civPoints, political };
}

// "Final de Campanha (minha pontuação)": each player runs it once per Campanha, after the trégua and
// before the Renovação. The points go straight into the Hegemonia counter. Each civilization scored
// queues its bonus for the next Renovação (renovacao() applies it). Influência Total: every
// civilization that ever reached 3 stays recorded in Reserva.marcas; all four win on the spot.
function finalDeCampanha() {
  const reserva = game.data.Reserva;
  if (reserva.pontuado) {
    functions.chatLog("Final de Campanha: a influência já foi pontuada nesta Campanha (a Renovação libera de novo).");
    return;
  }
  const counts = Object.fromEntries(CIVILIZATIONS.map((civ) => [civ, 0]));
  for (const card of cards?.Territorio ?? []) {
    const civ = card.cardData?.civilization;
    if (civ in counts) counts[civ] += 1;
  }
  const { scored, civPoints, political } = influenceScore(counts);
  reserva.hegemonia += civPoints + (political ? 1 : 0);
  reserva.pontuado = true;
  const marks = new Set((reserva.marcas ?? "").split(", ").filter(Boolean));
  scored.forEach((civ) => marks.add(civ));
  reserva.marcas = [...marks].join(", ");
  reserva.bonusRenovacao = scored.join(",");
  functions.chatLog(
    `Final de Campanha — Território: ${CIVILIZATIONS.map((civ) => `${civ} ${counts[civ]}`).join(", ")}. ` +
      `Influência: +${civPoints} (civilização)${political ? ", +1 (política)" : ""}. Hegemonia agora: ${reserva.hegemonia}.`,
  );
  if (scored.length > 0) functions.chatLog(`Bônus na Renovação: ${scored.join(", ")}.`);
  if (political) functions.chatLog("Influência política: escolha UM bônus de uma civilização que você NÃO pontuou nesta Campanha (aplique à mão).");
  if (marks.size === CIVILIZATIONS.length) functions.chatLog("INFLUÊNCIA TOTAL: as quatro civilizações conquistadas — vitória imediata!");
  else if (reserva.hegemonia >= 12) functions.chatLog(`Hegemonia ${reserva.hegemonia} (12 ou mais): vitória!`);
}

// "Renovação (minha parte)": each player runs this once per Renovação. Untaps the Território, applies
// the civilization bonuses queued by finalDeCampanha (Fenícia +1 ouro, Helênica +1 carta na mão;
// Latina and Celta are physical/choice bonuses, so they are only announced) and brings the hand to
// exactly 6 (7 with the Helênica bonus): draws if short; the player chooses what to discard if over.
// Colonist income and the Mercado roll are separate (the latter is advanceMarket, once per table).
async function renovacao() {
  const reserva = game.data.Reserva;
  const bonus = (reserva.bonusRenovacao ?? "").split(",").filter(Boolean);
  const tapped = (cards?.Territorio ?? []).filter((c) => c.isTapped);
  if (tapped.length > 0) await functions.updateCards(tapped, { isTapped: false });
  const target = bonus.includes("Helênica") ? 7 : 6;
  const hand = (cards?.Hand ?? []).length;
  if (hand < target) await drawWithReshuffle(target - hand);
  else if (hand > target) functions.chatLog(`Renovação: descarte ${hand - target} carta(s) da mão para o Descanso (a mão deve ter ${target}).`);
  if (bonus.includes("Fenícia")) {
    reserva.ouro += 1;
    functions.chatLog("Bônus Fenícia: +1 ouro.");
  }
  if (bonus.includes("Latina")) functions.chatLog("Bônus Latina: ganhe uma muralha (em uma Melhoria sua) ou uma ficha de força.");
  if (bonus.includes("Celta")) functions.chatLog("Bônus Celta: destrua uma carta do Mercado ou do seu Descanso durante a Campanha seguinte, no seu turno.");
  if (bonus.includes("Helênica")) functions.chatLog("Bônus Helênica: 1 carta a mais na mão (7).");
  reserva.bonusRenovacao = "";
  reserva.pontuado = false;
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
// The corner shortcut of a Mercado card moves it to the Mão (as a market *token*). Hand.onCardsEnter
// then runs comprarCarta(), which opens the "Compra" modal (a custom section rendered only for the
// buying player, game.data.Compra) asking: Compra plena / Compra normal / Cancelar. The choice runs
// concluirCompra(modo) or cancelarCompra().
// On confirmation the token is converted into a normal card of the buyer (updateCards: isToken false,
// startOwner = its current owner). Live findings: a token that enters the Império vanishes when
// drawn, and cards made with createCard (startOwner "UNOWNED") are invisible to the other player
// after they leave the deck. A normal card has neither problem.
//  - Combatente: plena -> top of the Império; normal -> Descanso (joins the Império at the next
//    reshuffle, approximating "fundo": scripts cannot put a card at the bottom).
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
    game.data.MercadoEstado.pendente = true;
    Object.assign(game.data.Compra, {
      open: true,
      id: bought.id,
      row: bought.position.section,
      posicao: { ...bought.position },
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
  game.data.MercadoEstado.pendente = false; // before the card changes below: they trigger the host's refill
  const token = (cards?.Hand ?? []).find((c) => c.id === compra.id);
  if (token) {
    await functions.updateCards([token], { isToken: false, startOwner: token.owner });
    if (compra.type === "Combatente") await functions.moveCard(token, plena ? "Deck" : "Discard");
  }
  functions.chatLog(
    plena
      ? `Compra plena: ${compra.name} (custo ${compra.cost})${compra.type === "Combatente" ? " vai para o topo do Império." : ". Direito a uma 2ª compra do mesmo tipo, custo ≤ " + compra.cost + "."}`
      : `Compra normal: ${compra.name} (custo ${compra.cost})${compra.type === "Combatente" ? " vai para o Descanso e entra no próximo Império." : "."}`,
  );
  game.data.Reserva.bonus = plena && compra.type !== "Combatente" ? `2ª compra: ${compra.type}, custo ≤ ${compra.cost}` : "";
  compra.open = false;
}

async function cancelarCompra() {
  const compra = game.data.Compra;
  // The refill was held while the modal was open, so the row still has its gap. The engine appends the
  // returned token at the end of the row, still owned by the buyer: it is given back to the shared pool
  // (UNOWNED, so the other player can buy it) and moved to the position it had, with an index just before
  // its old neighbour (repositionCards renumbers). updateCards works by card id, so the stale snapshot of the
  // token is enough.
  const token = (cards?.Hand ?? []).find((c) => c.id === compra.id);
  if (token) {
    await functions.moveCard(token, compra.row);
    // Back in the row the token still belonged to the buyer (the other player got no buy button on it).
    await functions.giveCardTo(token, "UNOWNED");
    if (compra.posicao?.section) {
      await functions.updateCards([token], { position: { ...compra.posicao, index: compra.posicao.index - 0.5 } });
      await functions.repositionCards();
    }
  }
  functions.chatLog(`Compra cancelada: ${compra.name} voltou ao Mercado.`);
  compra.open = false;
  game.data.MercadoEstado.pendente = false;
}

// --- Topo do Império (Capitais, [CONSCRITO] e outras cartas "olhe o topo do Império") ---------
// The engine's own "top card" panels do not work for this layout (docs/DIAGNOSTICS.md, E15), so the
// Reserva has an "Olhar topo do Império" button that opens the Topo panel: a custom section with
// playerRenderOnly, so only its owner sees it. getDeck() returns the own deck (index 0 = bottom, last =
// top). Nothing is revealed to the other player until "Mostrar aos outros". Moving a card to the bottom
// of the Império is not scriptable, so there is no such button: "Deixar no topo" just closes the panel.
async function olharTopo() {
  const topo = game.data.Topo;
  const deck = await functions.getDeck();
  if (deck.length === 0) {
    Object.assign(topo, { open: true, empty: true, name: "Império vazio", info: "Não há carta para olhar.", text: "", image: "" });
    return;
  }
  const card = deck[deck.length - 1];
  const full = card.cardData ?? {};
  const face = functions.getCardData(card) ?? full.face?.front ?? {};
  const type = face.type ?? full.type ?? "";
  const civilization = full.civilization ?? "";
  const cost = face.cost ?? full.cost;
  Object.assign(topo, {
    open: true,
    empty: false,
    name: face.name?.name ?? full.name ?? "Carta",
    info: [type, civilization, cost != null ? `custo ${cost}` : ""].filter(Boolean).join(" · "),
    text: full.abilityText ?? "",
    image: face.image ?? full.image ?? "",
    deckSize: deck.length,
  });
}

// Reserva.onCardsUpdate: keeps an open panel in sync with the deck (draws, reshuffles).
async function atualizarTopo() {
  if (game.data.Topo?.open) await olharTopo();
}

function mostrarTopo() {
  functions.chatLog(`Topo do Império mostrado: ${game.data.Topo.name}.`);
}

async function pegarTopo() {
  const topo = game.data.Topo;
  if (!topo.empty) {
    await functions.draw(1);
    functions.chatLog("Carta do topo do Império colocada na mão.");
  }
  topo.open = false;
}
