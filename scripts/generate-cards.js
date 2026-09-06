#!/usr/bin/env node
/**
 * Generates cards.json from data/raw-cards.json.
 *
 * data/raw-cards.json is produced by scripts/consolidate-extracted.js from
 * the three data/extracted-*.json transcriptions (see that script's header
 * for what it deduplicates/normalizes). mapCard() below maps that schema
 * onto the final cards.json entry shape. If a future card list arrives in a
 * different shape (a spreadsheet export, say), adjust mapCard() to match it
 * instead — the rest of this file (id collision checks, merge, output) stays
 * the same.
 *
 * Usage: node scripts/generate-cards.js
 * Rebuilds cards.json from scratch every time: data/hand-authored-cards.json
 * (Capitals/Trabalhadores, edited by hand) plus everything generated from
 * data/raw-cards.json. cards.json itself is pure output — never edit it
 * directly, edit one of those two sources and re-run this script instead.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW_PATH = path.join(ROOT, "data", "raw-cards.json");
const HAND_AUTHORED_PATH = path.join(ROOT, "data", "hand-authored-cards.json");
const CARDS_PATH = path.join(ROOT, "cards.json");
const IMAGE_BASE = "https://jfbaraky.github.io/cores/assets/cards/web";
const IMAGE_EXT = "webp";

function mapCard(raw) {
  const { id, type, civilization, name, cost, abilityText } = raw;
  const image = `${IMAGE_BASE}/${id}.${IMAGE_EXT}`;

  const card = {
    id,
    type,
    civilization,
    cost,
    copies: raw.copies ?? 1,
    keywords: raw.keywords ?? [],
    flavorText: raw.flavorText ?? null,
    artist: raw.artist ?? null,
    sourceFiles: raw.sourceFiles ?? [raw.sourceFile],
    face: {
      front: {
        name: { name },
        type,
        cost,
        image,
      },
    },
    name,
    abilityText,
    image,
  };

  if (type === "Combatente") {
    card.strength = raw.strength;
    card.weightClass = raw.weightClass; // Ligeiro | Médio | Pesado | null (e.g. Elefante)
    card.isCavalry = raw.isCavalry;
    card.role = raw.role ?? null;
  }

  if (type === "Melhoria") {
    card.subtype = raw.subtype ?? "";
    card.isCapital = false;
    card.activationType = raw.activationType; // Ativada | Fixa
    card.bottomLeftIcon = raw.bottomLeftIcon ?? null;
  }

  if (type === "Estratégia") {
    card.subtype = raw.subtype ?? "";
    card.bottomLeftIcon = raw.bottomLeftIcon ?? null;
  }

  return card;
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(
      `No raw card list found at ${RAW_PATH}.\n` +
        "Run scripts/consolidate-extracted.js first (or drop a compatible file at data/raw-cards.json) and re-run this script."
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf8"));
  const handAuthored = JSON.parse(fs.readFileSync(HAND_AUTHORED_PATH, "utf8"));

  const generated = {};
  for (const row of raw) {
    const card = mapCard(row);
    if (handAuthored[card.id]) {
      console.warn(`Skipping "${card.id}": id collides with a hand-authored card in data/hand-authored-cards.json.`);
      continue;
    }
    generated[card.id] = card;
  }

  const merged = { ...handAuthored, ...generated };
  fs.writeFileSync(CARDS_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(merged).length} cards to ${CARDS_PATH} (${Object.keys(generated).length} generated + ${Object.keys(handAuthored).length} hand-authored).`);
}

main();
