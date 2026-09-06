#!/usr/bin/env node
/**
 * Populates gamefile.json's beforeGameStart.initialBoardSetup with one
 * createCardId entry per real Combatente/Estratégia/Melhoria card (using its
 * `copies` count from cards.json), targeting the shared Mercado piles.
 *
 * Uses the OBJECT-keyed form ({ "0": [...] }), not a flat array, and only
 * populates player index "0" — the Mercado piles live in sharedZone, not per
 * player, and initialBoardSetup as a flat array runs once per player (this
 * bit us already: it double-drew every player's opening hand). Keying it to
 * a single player index is how the docs say to make something run once.
 *
 * Usage: node scripts/generate-market-setup.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CARDS_PATH = path.join(ROOT, "cards.json");
const GAMEFILE_PATH = path.join(ROOT, "gamefile.json");

const PILE_BY_TYPE = {
  Combatente: "MercadoCombatentesPilha",
  "Estratégia": "MercadoEstrategiasPilha",
  Melhoria: "MercadoMelhoriasPilha",
};

function main() {
  const cards = JSON.parse(fs.readFileSync(CARDS_PATH, "utf8"));
  const gamefile = JSON.parse(fs.readFileSync(GAMEFILE_PATH, "utf8"));

  const setup = [];
  for (const card of Object.values(cards)) {
    const destination = PILE_BY_TYPE[card.type];
    if (!destination) continue; // skip Capital / Trabalhador — not Market cards
    setup.push({ createCardId: card.id, count: card.copies ?? 1, destination });
  }

  const beforeGameStart = gamefile.gameplay.Padrao.beforeGameStart;
  beforeGameStart.initialBoardSetup = { "0": setup };

  fs.writeFileSync(GAMEFILE_PATH, JSON.stringify(gamefile, null, 2) + "\n");
  console.log(`Added ${setup.length} createCardId entries to beforeGameStart.initialBoardSetup["0"].`);
}

main();
