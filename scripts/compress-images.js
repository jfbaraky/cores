#!/usr/bin/env node
/**
 * Compresses the final card images (assets/cards/final/{id}.png — raw slide
 * exports, ~1-2MB each) into web-ready WebP files (assets/cards/web/{id}.webp).
 *
 * TCG Arena's docs don't specify a recommended card image size, so this uses
 * a sensible default for a card game UI: resize to 600px on the wide edge
 * (source cards are 720x1040, so this is a mild downscale, not an upscale)
 * and WebP quality 82 — legible at both hand-card and zoomed-in size, while
 * cutting a ~1.2MB PNG down to ~50-70KB.
 *
 * Requires `cwebp` (part of libwebp — on macOS: `brew install webp`).
 *
 * Usage: node scripts/compress-images.js
 * Re-run any time assets/cards/final/ changes (e.g. new cards added).
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "assets", "cards", "final");
const OUT_DIR = path.join(ROOT, "assets", "cards", "web");

const RESIZE_WIDTH = 600; // 0 = keep original height, preserves aspect ratio
const QUALITY = 82;

function checkCwebp() {
  try {
    execFileSync("cwebp", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("cwebp not found. Install libwebp first, e.g.: brew install webp");
    process.exit(1);
  }
}

function main() {
  checkCwebp();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith(".png"));
  if (files.length === 0) {
    console.error(`No .png files found in ${path.relative(ROOT, SRC_DIR)}`);
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of files) {
    const id = path.basename(file, ".png");
    const src = path.join(SRC_DIR, file);
    const dest = path.join(OUT_DIR, `${id}.webp`);

    execFileSync("cwebp", ["-q", String(QUALITY), "-resize", String(RESIZE_WIDTH), "0", src, "-o", dest], {
      stdio: "ignore",
    });

    totalBefore += fs.statSync(src).size;
    totalAfter += fs.statSync(dest).size;
  }

  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  console.log(`Compressed ${files.length} images: ${mb(totalBefore)}MB -> ${mb(totalAfter)}MB (${(totalBefore / totalAfter).toFixed(1)}x smaller)`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}/`);
}

main();
