#!/usr/bin/env node
/**
 * One-time (re-runnable) consolidation pass over the three data/extracted-*.json
 * files produced by transcribing the card images (see data/extracted-*.json).
 *
 * What it does:
 *  - Drops known drafts/placeholders (isDraft: true, and the explicitly
 *    excluded joke card "Dyego, Cachorro" per project decision).
 *  - Applies the one manual rename fix: "Santuário de Epona" is the same card
 *    as "Templo de Epona" (per project decision) — merged under the Templo name.
 *  - Collapses cards that are the same design printed more than once (same
 *    civilization + name, appearing on multiple slides) into a single card
 *    definition with a `copies` count, instead of duplicate ids. Estratégias
 *    are intentionally NOT deduped this way, because their one name collision
 *    ("Circunvalação") is two mechanically different cards, not a reprint.
 *  - Normalizes a couple of known transcription quirks (see NORMALIZATIONS).
 *  - Copies each surviving card's source image into assets/cards/final/{id}.png
 *    so cards.json can reference a clean, stable filename.
 *
 * Output: data/raw-cards.json — the input scripts/generate-cards.js expects.
 *
 * Usage: node scripts/consolidate-extracted.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const ASSETS_DIR = path.join(ROOT, "assets", "cards");
const FINAL_ASSETS_DIR = path.join(ASSETS_DIR, "final");

const SOURCE_FOLDERS = {
  Combatente: "COMBATENTES",
  Estratégia: "ESTRATÉGIAS",
  Melhoria: "MELHORIAS",
};

const EXCLUDED_IDS = new Set([
  "combatente-dyego-cachorro", // joke/test card, excluded per project decision
]);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

function normalizeNameKey(civilization, name) {
  return `${civilization}||${name.trim().toUpperCase()}`;
}

/** Merge a duplicate occurrence's fields into the canonical card wherever the canonical field is empty. */
function fillMissing(canonical, dupe) {
  for (const field of ["artist", "flavorText", "role", "bottomLeftIcon"]) {
    if ((canonical[field] === null || canonical[field] === undefined) && dupe[field] != null) {
      canonical[field] = dupe[field];
    }
  }
  // Prefer the longer/more complete ability text and subtype (some duplicate
  // slides have abbreviated or slightly different printings).
  if (dupe.abilityText && dupe.abilityText.length > (canonical.abilityText || "").length) {
    canonical.abilityText = dupe.abilityText;
  }
  if (dupe.subtype && dupe.subtype.length > (canonical.subtype || "").length) {
    canonical.subtype = dupe.subtype;
  }
  return canonical;
}

/** Collapse same civilization+name entries into one card with a `copies` count. */
function dedupeByName(cards) {
  const groups = new Map();
  for (const card of cards) {
    const key = normalizeNameKey(card.civilization, card.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  const result = [];
  for (const group of groups.values()) {
    const [canonical, ...dupes] = group;
    for (const dupe of dupes) fillMissing(canonical, dupe);
    canonical.copies = group.length;
    canonical.sourceFiles = group.map((c) => c.sourceFile);
    result.push(canonical);
  }
  return result;
}

function applyNormalizations(cards) {
  for (const card of cards) {
    // Scutarii's ability text lost its brackets in the original transcription.
    if (card.id === "combatente-scutarii" && card.abilityText === "LANCEAR") {
      card.abilityText = "[LANCEAR]";
    }
    // "Cartografia"'s bracketed phrase is a timing clause, not a real keyword.
    if (card.id === "estrategia-cartografia") {
      card.keywords = [];
    }
  }
  return cards;
}

function copyImage(type, card) {
  const folder = SOURCE_FOLDERS[type];
  const src = path.join(ASSETS_DIR, folder, card.sourceFile);
  const dest = path.join(FINAL_ASSETS_DIR, `${card.id}.png`);
  fs.copyFileSync(src, dest);
}

function main() {
  fs.mkdirSync(FINAL_ASSETS_DIR, { recursive: true });

  let combatentes = loadJson("extracted-combatentes.json").filter((c) => !c.isDraft && !EXCLUDED_IDS.has(c.id));
  let estrategias = loadJson("extracted-estrategias.json").filter((c) => !c.isDraft);
  let melhorias = loadJson("extracted-melhorias.json").filter((c) => !c.isDraft);

  // Manual fix: Santuário de Epona (Slide23) is the same card as Templo de
  // Epona (Slide18), just an outdated name — rename before dedupe so they merge.
  melhorias = melhorias.map((c) =>
    c.id === "melhoria-santuario-de-epona" ? { ...c, name: "Templo de Epona" } : c
  );

  combatentes = dedupeByName(combatentes);
  melhorias = dedupeByName(melhorias);
  estrategias = estrategias.map((c) => ({ ...c, copies: 1, sourceFiles: [c.sourceFile] })); // no dedupe: see header comment

  combatentes = applyNormalizations(combatentes);
  estrategias = applyNormalizations(estrategias);
  melhorias = applyNormalizations(melhorias);

  const all = [...combatentes, ...estrategias, ...melhorias];

  for (const card of all) {
    copyImage(card.type, card);
  }

  fs.writeFileSync(path.join(DATA_DIR, "raw-cards.json"), JSON.stringify(all, null, 2) + "\n");

  console.log(`Combatentes: ${combatentes.length} distinct cards (${combatentes.reduce((s, c) => s + c.copies, 0)} physical copies)`);
  console.log(`Estratégias: ${estrategias.length} distinct cards`);
  console.log(`Melhorias:   ${melhorias.length} distinct cards (${melhorias.reduce((s, c) => s + c.copies, 0)} physical copies)`);
  console.log(`Total: ${all.length} card definitions written to data/raw-cards.json`);
  console.log(`Images copied to ${path.relative(ROOT, FINAL_ASSETS_DIR)}/`);
}

main();
