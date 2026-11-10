#!/usr/bin/env node
/**
 * Regroupe les fichiers JSON de /src/data dans src/data/bundle.js.
 * Le bundle permet de lancer le jeu en double-cliquant index.html,
 * sans serveur local (fetch sur file:// est bloqué par les navigateurs).
 *
 * Usage : node tools/build-data.js
 */
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "data");
const files = fs
  .readdirSync(dataDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

const data = {};
for (const file of files) {
  const key = path.basename(file, ".json");
  const raw = fs.readFileSync(path.join(dataDir, file), "utf8");
  data[key] = JSON.parse(raw);
  console.log(`  ✓ ${file}`);
}

const banner = `/* Généré automatiquement par tools/build-data.js — ne pas éditer à la main.
   Modifiez les fichiers /src/data/*.json puis relancez : npm run build:data */
`;
const output = `${banner}window.GAME_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(path.join(dataDir, "bundle.js"), output, "utf8");
console.log(`\nBundle écrit : src/data/bundle.js (${(output.length / 1024).toFixed(1)} Ko)`);
