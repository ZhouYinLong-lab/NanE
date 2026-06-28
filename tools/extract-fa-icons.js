#!/usr/bin/env node

/**
 * Font Awesome Icon Subset Extractor
 *
 * This script documents which Font Awesome icons are used in the NanE project
 * and can generate a subset CSS file containing only the used icons.
 *
 * Usage:
 *   node tools/extract-fa-icons.js              # print used icon table
 *   node tools/extract-fa-icons.js --subset     # generate web/css/fa-subset.css
 *
 * When adding a new Font Awesome icon to the project, add its unicode
 * codepoint to the USED_ICONS array below so the subset stays correct.
 */

const fs = require("fs");
const path = require("path");

// ── All Font Awesome codepoints used in the project ────────────────
// Each entry: { codepoint: "hex", source: "where used", label: "FA icon name (best guess)" }
//
// Sources:
//   app.js   => the `icons` object and literal strings
//   index.html => literal PUA characters and HTML entities
//
// When you add a new icon, append its hex codepoint here.

const USED_ICONS = [
  // --- Icons for item categories (app.js `icons` object, lines 6-27) ---
  { codepoint: "f462", source: "app.js icons.bandage",        label: "bandage" },
  { codepoint: "f481", source: "app.js icons.notesMedical",   label: "notes-medical" },
  { codepoint: "f479", source: "app.js icons.kitMedical",     label: "kit-medical" },
  { codepoint: "f46b", source: "app.js icons.capsules",       label: "capsules" },
  { codepoint: "f484", source: "app.js icons.pills",          label: "pills" },
  { codepoint: "f490", source: "app.js icons.tablets",        label: "tablets" },
  { codepoint: "f486", source: "app.js icons.prescriptionBottleMedical", label: "prescription-bottle" },
  { codepoint: "f2c9", source: "app.js icons.temperatureHalf", label: "temperature-half" },
  { codepoint: "e1d7", source: "app.js icons.maskFace",       label: "mask-face" },
  { codepoint: "e06c", source: "app.js icons.shieldVirus",    label: "shield-virus" },
  { codepoint: "e06a", source: "app.js icons.pumpMedical",    label: "pump-medical" },
  { codepoint: "e4c4", source: "app.js icons.bottleDroplet",  label: "bottle-droplet" },
  { codepoint: "f466", source: "app.js icons.box",            label: "box" },
  { codepoint: "f49e", source: "app.js icons.boxOpen",        label: "box-open" },
  { codepoint: "f043", source: "app.js icons.droplet",        label: "droplet" },
  { codepoint: "e05c", source: "app.js icons.handHoldingMedical", label: "hand-holding-medical" },
  { codepoint: "f21e", source: "app.js icons.heartPulse",     label: "heart-pulse" },
  { codepoint: "f48e", source: "app.js icons.syringe",        label: "syringe" },
  { codepoint: "e06e", source: "app.js icons.soap",           label: "soap" },

  // --- Toast icons (app.js line 238) ---
  { codepoint: "f058", source: "app.js toast success",        label: "circle-check" },
  { codepoint: "f057", source: "app.js toast error",          label: "circle-xmark" },
  { codepoint: "f05a", source: "app.js toast info",           label: "circle-info" },

  // --- Icon grid toggle (app.js line 1573) ---
  { codepoint: "f141", source: "app.js icon toggle more",     label: "ellipsis" },

  // --- HTML index.html ---
  { codepoint: "f021", source: "index.html refresh button",   label: "rotate" },
  { codepoint: "f06c", source: "index.html welcome banner",   label: "gift" },
  { codepoint: "f4be", source: "index.html guest publish",    label: "hand-holding-heart" },
  { codepoint: "f058", source: "index.html publish success",  label: "circle-check (dup)" },
  { codepoint: "f14e", source: "index.html nav home",         label: "th-large / grid" },
  { codepoint: "f055", source: "index.html nav publish",      label: "circle-plus" },
  { codepoint: "f007", source: "index.html nav mine",         label: "user" },
  { codepoint: "f00d", source: "index.html close buttons (x4)", label: "xmark" },
];

// ── Helpers ────────────────────────────────────────────────────────

function uniqueCodepoints() {
  const seen = new Set();
  return USED_ICONS.filter((entry) => {
    const key = entry.codepoint;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hexList() {
  return uniqueCodepoints().map((e) => e.codepoint).sort();
}

function unicodeRangeArg() {
  return hexList()
    .map((h) => `U+${h.toUpperCase()}`)
    .join(",");
}

// ── Actions ────────────────────────────────────────────────────────

function printTable() {
  console.log("╔════════════╤══════════════════════════════════════╤══════════════════╗");
  console.log("║ Codepoint  │ Source                              │ Icon             ║");
  console.log("╠════════════╪══════════════════════════════════════╪══════════════════╣");
  for (const entry of USED_ICONS) {
    const cp = `U+${entry.codepoint.toUpperCase().padEnd(6, " ")}`;
    const src = entry.source.padEnd(36, " ").slice(0, 36);
    const label = entry.label.padEnd(16, " ").slice(0, 16);
    console.log(`║ ${cp} │ ${src} │ ${label} ║`);
  }
  console.log("╚════════════╧══════════════════════════════════════╧══════════════════╝");
  console.log(`\nTotal unique icons: ${uniqueCodepoints().length}`);
  console.log(`\nUnicode range for pyftsubset:\n  ${unicodeRangeArg()}`);
}

function generateSubset() {
  const faCssPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "@fortawesome",
    "fontawesome-free",
    "css",
    "all.min.css"
  );

  if (!fs.existsSync(faCssPath)) {
    console.error(
      "Font Awesome CSS not found at " + faCssPath + "\n" +
      "Install it first: npm install @fortawesome/fontawesome-free"
    );
    process.exit(1);
  }

  const fullCss = fs.readFileSync(faCssPath, "utf8");

  const codepoints = hexList();

  // FA7 uses CSS variable format: .fa-name,.fa-alias{--fa:"\codepoint"}
  // The CSS file has literal backslash (0x5C) + hex codepoint
  // We search by scanning around each codepoint occurrence

  const matchedRulesSet = new Set();
  for (const cp of codepoints) {
    const searchLc = `--fa:"\\${cp.toLowerCase()}"`;
    const searchUc = `--fa:"\\${cp.toUpperCase()}"`;
    const idx = fullCss.indexOf(searchLc);
    const idxUpper = idx >= 0 ? -1 : fullCss.indexOf(searchUc);
    const foundIdx = idx >= 0 ? idx : idxUpper;
    if (foundIdx < 0) continue;

    // Back up to find the start of the selector (before the first {--fa)
    let start = foundIdx;
    while (start > 0 && fullCss[start] !== "}") start--;
    if (fullCss[start] === "}") start++; // move past the }

    const end = fullCss.indexOf("}", foundIdx);
    if (end > start) {
      matchedRulesSet.add(fullCss.slice(start, end + 1).trim());
    }
  }

  const matchedRules = [...matchedRulesSet];

  let output = "/*! Font Awesome Free 7.x subset — NanE project */\n";
  output += "/* Generated by tools/extract-fa-icons.js */\n";
  output += "/* Icons included: " + codepoints.length + " */\n";
  output += "/* @font-face is in web/css/tokens.css — do not duplicate */\n\n";

  // Write essential base rules from the full CSS needed for FA to work
  output += "/* FA base rules (abbreviated) */\n";
  output += ".fa,.fa-solid,.fas {\n";
  output += "  --_fa-family: var(--fa-family, var(--fa-style-family, \"Font Awesome 7 Free\"));\n";
  output += "  -webkit-font-smoothing: antialiased;\n";
  output += "  -moz-osx-font-smoothing: grayscale;\n";
  output += "  display: var(--fa-display, inline-block);\n";
  output += "  font-family: var(--_fa-family);\n";
  output += "  font-style: normal;\n";
  output += "  font-weight: var(--fa-style, 900);\n";
  output += "  line-height: 1;\n";
  output += "}\n";
  output += ".fa-solid,.fas:before {\n";
  output += "  content: var(--fa) / \"\";\n";
  output += "}\n\n";

  // Write each matched icon rule
  for (const rule of matchedRules) {
    output += rule + "\n";
  }

  const outPath = path.join(__dirname, "..", "web", "css", "fa-subset.css");
  fs.writeFileSync(outPath, output, "utf8");
  console.log(`Wrote ${matchedRules.length} icon rules to ${outPath}`);
}

function printSubsetInstructions() {
  console.log("\n── Subset the WOFF2 font file ──────────────────────────────");
  console.log("");
  console.log("Prerequisites:");
  console.log("  pip install fonttools");
  console.log("");
  console.log("Command:");
  console.log("  cd miniprogram/assets/fontawesome");
  console.log(`  pyftsubset fa-solid-900.woff2 \\`);
  console.log(`    --unicodes=${unicodeRangeArg()} \\`);
  console.log(`    --output-file=fa-subset.woff2 \\`);
  console.log(`    --flavor=woff2`);
  console.log("");
  console.log("Then update web/css/tokens.css to reference fa-subset.woff2");
  console.log("and regenerate web/css/fa-subset.css with:");
  console.log("  node tools/extract-fa-icons.js --subset");
  console.log("");
  console.log("If you ever add a new icon, update the USED_ICONS array in");
  console.log("this script and re-run both steps.");
}

// ── Main ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--subset")) {
  generateSubset();
  printSubsetInstructions();
} else if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node tools/extract-fa-icons.js [--subset]");
  console.log("  (no args)   Print the icon usage table");
  console.log("  --subset    Generate web/css/fa-subset.css");
} else {
  printTable();
  printSubsetInstructions();
}
