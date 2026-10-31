// Cores da Guerra — TCG Arena scripts.
// Only native building blocks are used (see docs/TCGA-REFERENCE.md): moveCard,
// drawFromExtraDeck, shuffleSection, getDeck, chatLog and the cards/game globals.
// No module-level flags: scripts run in a sandbox and module state does not persist.
// Every function below is idempotent by construction (it inspects the board first).

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
  await ordenarFileiras();
  await fillMarket();
}

// Mercado conveyor (manual §11.4): in each row the NEWEST card is on the LEFT and the OLDEST on the right; the
// Renovação destroys the rightmost one and the first player's +1 surcharge applies to the leftmost column. The engine
// puts a refilled card at either end of the row (seen on both), so each card carries its arrival number in its own
// `notes` field ("idade:N", higher = newer) and the positions are rewritten from it. (A list kept in shared game data
// does not work: two runs overlap and the second one reads the value before the first run's write has landed.)
// Cards waiting in a Compra modal are not in the row: the caller skips this while a purchase is pending, so a
// cancelled card keeps its age and its place.
function idadeDe(card) {
  const m = /^idade:(\d+)$/.exec(card.notes ?? "");
  return m ? Number(m[1]) : null;
}

async function ordenarFileiras() {
  let proxima = 1 + Math.max(0, ...MARKET_PILES.flatMap(({ revealed }) => (cards?.[revealed] ?? []).map((c) => idadeDe(c) ?? 0)));
  const changes = [];
  for (const { revealed } of MARKET_PILES) {
    const shown = [...(cards?.[revealed] ?? [])].sort((a, b) => a.position.index - b.position.index);
    // Cards without an age are the newest; several at once (the start): the one on the right counts as older.
    const aged = shown.map((c) => ({ card: c, idade: idadeDe(c), novo: idadeDe(c) === null }));
    for (const entry of aged) if (entry.novo) entry.idade = proxima++;
    [...aged].sort((a, b) => b.idade - a.idade).forEach((entry, index) => {
      const change = {};
      if (entry.novo) change.notes = `idade:${entry.idade}`;
      if (entry.card.position.index !== index) change.position = { ...entry.card.position, index };
      if (Object.keys(change).length > 0) changes.push([entry.card, change]);
    });
  }
  for (const [card, change] of changes) await functions.updateCards([card], change);
  if (changes.some(([, change]) => change.position)) await functions.repositionCards();
}

const sleep = (ms) => new Promise((resolve) => (typeof setTimeout === "function" ? setTimeout(resolve, ms) : resolve()));

// "Repor Mercado" button: rescue for a row left short. A buyer who closes the browser with the Compra modal open
// leaves the shared MercadoEstado.pendente flag set, which stops the automatic refill; this clears it and refills.
async function reporMercado() {
  game.data.MercadoEstado.pendente = false;
  await fillMarket();
}

// Shuffles each pile and reveals the first 4. No-op once any row already has cards.
async function setupMarket() {
  if (!game.isHost) return;
  if (MARKET_PILES.some(({ revealed }) => (cards?.[revealed] ?? []).length > 0)) return;
  for (const { pile } of MARKET_PILES) await functions.shuffleSection(pile);
  await fillMarket();
}

// Renovação (manual §11.4): the oldest card of each row (lowest `idade`, normally the rightmost one, see ordenarFileiras)
// goes to its discard; keepMarketFull then refills the rows (fillMarket is not called here to avoid a double refill).
async function advanceMarket() {
  for (const { revealed, discard } of MARKET_PILES) {
    const shown = cards?.[revealed] ?? [];
    if (shown.length === 0) continue;
    const oldest = [...shown].sort((a, b) => (idadeDe(a) ?? 1e9) - (idadeDe(b) ?? 1e9) || b.position.index - a.position.index)[0];
    await functions.moveCard(oldest, discard);
    functions.chatLog(`${functions.getCardData(oldest)?.name?.name ?? "Carta"} descartada do Mercado (Renovação).`);
  }
}

// --- Fim do turno e Renovação (manual §10.3, §11.4) ---------------------------
const RESOURCE_KEYS = ["roxo", "vermelho", "azul", "verde", "ouro"];

// Reserva.onNewTurn: runs on every client at every turn change. §10.3: resources not stored on
// Melhorias are discarded when *your* turn ends. Since the platform update of October 2026 `game.turn.isMyTurn`
// inside this handler describes the turn that has just STARTED (before it described the one that ended; the
// discard then ran at the start of your NEXT turn, so the leftovers stayed visible to the opponent and anything
// received during their turn was wiped). So "my turn just ended" = it is not my turn now and it was before:
// the previous value is kept in Reserva.turnoMeu ("sim"/"nao"; empty at the very first event, which counts as "was mine"
// so the starting player's first turn is cleaned even if the game start fires no event).
function endOfTurnCleanup() {
  const reserva = game.data.Reserva;
  const mine = Boolean(game.turn.isMyTurn);
  const was = reserva.turnoMeu;
  reserva.turnoMeu = mine ? "sim" : "nao";
  // The game start fires one event on every client with `isMyTurn` = "I start" (live-checked); `orderPosition` is the client's own seat.
  if (was === "" && !reserva.primeiro) reserva.primeiro = mine ? "sim" : "nao";
  if (mine || was === "nao") return;
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

// "Encerrar conflito (minhas cartas)": after an Assalto/Combate the owner sends their own cards left on the
// Campo de Batalha to the Descanso in one go (the manual puts survivors and fallen of both sides in their owners'
// Descanso). Each player runs it for their own cards: a player cannot move the other one's.
async function encerrarConflito() {
  const me = cards?.Territorio?.[0]?.owner;
  const mine = (cards?.CampoDeBatalha ?? []).filter((c) => !me || c.owner === me);
  if (mine.length === 0) {
    functions.chatLog("Encerrar conflito: não há cartas suas no Campo de Batalha.");
    return;
  }
  // One moveCard per card: the batch moveCards does not notify the script's snapshot of `cards`, so a second click would
  // still see the cards on the Campo.
  for (const card of mine) await functions.moveCard(card, "Discard", { noLogs: true });
  functions.chatLog(`Conflito encerrado: ${mine.length} carta(s) foram para o Descanso.`);
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
    if (!MELHORIA_TYPES.includes(card.cardData?.type)) continue;
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
// Also generates the colonos' income (§8.4) and counts the new Campanha (first-player surcharge, §11.2).
// The Mercado roll is separate (advanceMarket, once per table).
async function renovacao() {
  const reserva = game.data.Reserva;
  const bonus = (reserva.bonusRenovacao ?? "").split(",").filter(Boolean);
  const tapped = (cards?.Territorio ?? []).filter((c) => c.isTapped);
  if (tapped.length > 0) await functions.updateCards(tapped, { isTapped: false });
  gerarDosColonos();
  proximaCampanha();
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

// --- Colonos (manual §8.4, §10.2, §11.4) ----------------------------------------------
// Colonizar = allocate a Trabalhador on an eligible Melhoria of YOUR Território. Eligible: a Melhoria (the Capital is one)
// of the worker's own civilization, that does not generate resources by itself (cards.json `producesColor: true`) and that has
// no colono yet. The allocation is permanent. The worker card sits in the Território right after its Melhoria and carries
// `notes: "colono:<id of the Melhoria>"`; the Melhoria's own `notes` names the colono. Each Renovação ("Renovação
// (minha parte)") every colono whose Melhoria is still in play generates 1 resource of its colour (2 with Sicília) into the
// Reserva, to be stored by the end of the owner's next turn like any other gain. If the Melhoria was lost (Assalto), the
// colono is an orphan: its fate (perdoar, destruir, capturar, §14.2) is the attacker's, the owner moves the card
// (Descanso / Desterro) by hand, and an orphan generates nothing.
const MELHORIA_TYPES = ["Melhoria", "Capital"];
const CIV_COLOR = { "Helênica": "roxo", "Latina": "vermelho", "Fenícia": "azul", "Celta": "verde" };

function colonoDe(card) {
  const m = /^colono:(.+)$/.exec(card.notes ?? "");
  return m ? m[1] : null;
}

// The Trabalhadores allocated in the Território (the card ids of the Melhorias they sit on are in `notes`).
function colonosEmJogo() {
  return (cards?.Territorio ?? []).filter((c) => c.cardData?.type === "Trabalhador" && colonoDe(c));
}

function melhoriasElegiveis(civ) {
  const ocupadas = new Set(colonosEmJogo().map(colonoDe));
  return (cards?.Territorio ?? []).filter(
    (c) =>
      MELHORIA_TYPES.includes(c.cardData?.type) &&
      c.cardData?.civilization === civ &&
      c.cardData?.producesColor !== true &&
      !ocupadas.has(c.id),
  );
}

const nomeDe = (card) => card.cardData?.name ?? functions.getCardData(card)?.name?.name ?? "Carta";

// Reserva "Colonizar": lists every (worker in hand -> eligible Melhoria) pair in the Colonizar panel (a worker of each
// civilization in the hand is offered once).
function abrirColonizar() {
  const opcoes = [];
  for (const civ of Object.keys(CIV_COLOR)) {
    const worker = (cards?.Hand ?? []).find((c) => c.cardData?.type === "Trabalhador" && c.cardData?.civilization === civ);
    if (!worker) continue;
    for (const melhoria of melhoriasElegiveis(civ)) {
      opcoes.push({ texto: `${nomeDe(worker)} → ${nomeDe(melhoria)}`, trabalhador: worker.id, melhoria: melhoria.id });
    }
  }
  Object.assign(game.data.Colonizar, { open: true, opcoes, vazio: opcoes.length === 0 });
}

// Called from the panel's loop buttons (the engine rewrites `[index]` in their onClick into the position of the item).
async function colonizar(trabalhadorId, melhoriaId) {
  game.data.Colonizar.open = false;
  const worker = (cards?.Hand ?? []).find((c) => c.id === trabalhadorId);
  const melhoria = (cards?.Territorio ?? []).find((c) => c.id === melhoriaId);
  if (!worker || !melhoria || !melhoriasElegiveis(worker.cardData?.civilization).some((c) => c.id === melhoria.id)) {
    functions.chatLog("Colonizar: a carta mudou de lugar ou a Melhoria já tem colono; tente de novo.");
    return;
  }
  await functions.moveCard(worker, "Territorio", { noLogs: true });
  await functions.updateCards([worker], {
    notes: `colono:${melhoria.id}`,
    position: { ...worker.position, section: "Territorio", index: melhoria.position.index + 0.5 },
  });
  await functions.updateCards([melhoria], { notes: `Colono: ${nomeDe(worker)}` });
  await functions.repositionCards();
  functions.chatLog(`Colonizar: ${nomeDe(worker)} alocado em ${nomeDe(melhoria)}. A partir da próxima Renovação gera 1 ${CIV_COLOR[worker.cardData.civilization]} por Campanha.`);
}

// Part of renovacao(): income of the colonos (§11.4 "Gerar recursos").
function gerarDosColonos() {
  const reserva = game.data.Reserva;
  const naMesa = new Set((cards?.Territorio ?? []).map((c) => c.id));
  const dobro = (cards?.Territorio ?? []).some((c) => c.cardData?.id === "melhoria-sicilia") ? 2 : 1;
  const ganhos = [];
  for (const worker of colonosEmJogo()) {
    if (!naMesa.has(colonoDe(worker))) {
      functions.chatLog(`Colono órfão: ${nomeDe(worker)} perdeu a Melhoria. Destino do colono (§14.2): perdoar = Descanso, destruir = Desterro, capturar = o atacante o aloca; mova a carta à mão.`);
      continue;
    }
    const cor = CIV_COLOR[worker.cardData?.civilization];
    if (!cor) continue;
    reserva[cor] += dobro;
    ganhos.push(`+${dobro} ${cor}`);
  }
  if (ganhos.length > 0) functions.chatLog(`Colonos geraram: ${ganhos.join(", ")}. Armazene-os nas Melhorias até o fim do seu próximo turno.`);
}

// --- Campanha e primazia (manual §11.2) ------------------------------------------------
// The engine does not know the Campanha or who has the primazia. Reserva.campanha counts the Renovações (each player's own
// "Renovação (minha parte)" adds 1) and Reserva.primeiro ("sim"/"nao") says whether I am the first player of the current
// Campanha: set from the first turn event, flipped at every Renovação (2 players: the primazia alternates). From the 2nd
// Campanha the first player pays +1 on the leftmost (newest) column of the Mercado, while it is their turn (see
// comprarCarta). The "Trocar 1º jogador" button corrects it when the table agreed on another order.
function proximaCampanha() {
  const reserva = game.data.Reserva;
  reserva.campanha = (reserva.campanha ?? 1) + 1;
  if (game.turn.totalPlayers === 2 && reserva.primeiro) reserva.primeiro = reserva.primeiro === "sim" ? "nao" : "sim";
  functions.chatLog(`Campanha ${reserva.campanha}. ${reserva.primeiro === "sim" ? "Você é o 1º jogador: paga +1 na coluna mais nova do Mercado." : "Você não é o 1º jogador."}`);
}

function trocarPrimeiro() {
  const reserva = game.data.Reserva;
  reserva.primeiro = reserva.primeiro === "sim" ? "nao" : "sim";
  functions.chatLog(`Primazia: você ${reserva.primeiro === "sim" ? "é" : "não é"} o 1º jogador da Campanha ${reserva.campanha ?? 1}.`);
}

// --- Início da partida (manual §7.1 passo 9) ---------------------------------------------
// The Capital enters play with one resource of its colour on it. The digital Reserva has no token on cards, so the
// resource is given in the Reserva: spend it this turn or store it (drag a token onto the Capital), otherwise it is lost
// at the pass like any unstored resource.
function iniciarJogador() {
  const reserva = game.data.Reserva;
  if (reserva.inicial) return;
  reserva.inicial = true;
  reserva.campanha = 1;
  const capital = (cards?.Territorio ?? []).find((c) => c.cardData?.type === "Capital");
  const cor = CIV_COLOR[capital?.cardData?.civilization];
  if (!cor) return;
  reserva[cor] += 1;
  functions.chatLog(`Capital em jogo: ${nomeDe(capital)} entra com 1 ficha de recurso ${cor}. Gaste-a neste turno ou guarde-a (arraste uma ficha para a Capital).`);
}

// Reserva "Sacar 1 carta": draw from the Império (§5), rebuilding it from the Descanso only if it is empty.
async function sacarCarta() {
  await drawWithReshuffle(1);
  functions.chatLog("Sacou 1 carta do Império.");
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
//  - Combatente: plena -> top of the Império; normal -> bottom of the Império (paraOFundo).
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
    const custo = Number(data?.cost ?? data?.face?.front?.cost ?? 0);
    // §11.2: from the 2nd Campanha the first player pays +1 on the leftmost (newest) column, while it is their turn.
    const reserva = game.data.Reserva;
    const sobretaxa = reserva.primeiro === "sim" && (reserva.campanha ?? 1) >= 2 && bought.position?.index === 0 ? 1 : 0;
    game.data.MercadoEstado.pendente = true;
    Object.assign(game.data.Compra, {
      open: true,
      id: bought.id,
      row: bought.position.section,
      posicao: { ...bought.position },
      type,
      name: data?.face?.front?.name?.name ?? type,
      cost: custo,
      custoTexto: sobretaxa ? `custo ${custo} + 1 de sobretaxa do 1º jogador = ${custo + sobretaxa}` : `custo ${custo}`,
      hint:
        type === "Combatente"
          ? "Plena: vai para o topo do Império. Normal: vai para o fundo do Império."
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
    await functions.updateCards([token], { isToken: false, startOwner: token.owner, notes: "" });
    if (compra.type === "Combatente") {
      await functions.moveCard(token, "Deck");
      if (!plena) await paraOFundo(token);
    }
  }
  functions.chatLog(
    plena
      ? `Compra plena: ${compra.name} (${compra.custoTexto})${compra.type === "Combatente" ? " vai para o topo do Império." : ". Direito a uma 2ª compra do mesmo tipo, custo ≤ " + compra.cost + "."}`
      : `Compra normal: ${compra.name} (${compra.custoTexto})${compra.type === "Combatente" ? " vai para o fundo do Império." : "."}`,
  );
  game.data.Reserva.bonus = plena && compra.type !== "Combatente" ? `2ª compra: ${compra.type}, custo ≤ ${compra.cost}` : "";
  compra.open = false;
  // The host's refill hangs on onCardsUpdate, which updateCards does not trigger (an Estratégia/Melhoria confirm moves no
  // card), so a host buyer tops the row up here. The snapshot still shows the gap, so exactly one card is drawn.
  if (game.isHost) await fillMarket();
}

// Slots a card at the very bottom of the Império (index 0; getDeck() lists the bottom first). moveCard puts it on top; the
// card then gets an index below every other and repositionCards renumbers the pile.
async function paraOFundo(card) {
  await functions.updateCards([card], { position: { ...card.position, section: "Deck", index: -0.5 } });
  await functions.repositionCards();
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
  // The table is told that someone looked, never which card. Not logged again when atualizarTopo refreshes
  // a panel that is already open.
  if (!topo.open) functions.chatLog("Olhou a carta do topo do Império.");
  const deck = await functions.getDeck();
  functions.chatLog(`[dbg] deck n=${deck.length} fundo=${deck[0]?.cardData?.name} topo=${deck[deck.length - 1]?.cardData?.name}`); // TEMP
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
