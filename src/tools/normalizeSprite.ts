/**
 * CLI : normalise une planche générée et l'écrit dans `public/sprites/`.
 *
 *   npm run sprite:normalize -- <id> <entrée.png> [--crop x,y,w,h] [--key RRGGBB]
 *
 * Réduit en `nearest` à la grille de `SPRITES[id]`, binarise l'alpha, incruste
 * optionnellement une couleur de fond, quantifie à `PALETTE`, puis vérifie le
 * résultat. Affiche un rapport ; termine en erreur si la planche ne rentre pas
 * dans la grille ou si la vérification échoue. Ne touche pas à `sprites.ts` :
 * renseigner `file` reste un geste conscient, après avoir regardé l'image.
 */

import { SPRITES, type SpriteId } from '../data/sprites.ts';
import { readPng, writePng } from './png.ts';
import { normalizeSheet, verifySheet, type NormalizeOptions } from './spriteSheet.ts';

function usage(message: string): never {
  console.error(message);
  console.error('Usage : npm run sprite:normalize -- <id> <entrée.png> [--crop x,y,w,h] [--key RRGGBB]');
  process.exit(1);
}

const [id, input, ...rest] = process.argv.slice(2);
if (!id || !input) usage('Il manque l’identifiant du sprite ou le fichier d’entrée.');
if (!(id in SPRITES)) usage(`Sprite inconnu : ${id}. Connus : ${Object.keys(SPRITES).join(', ')}.`);
const proto = SPRITES[id as SpriteId];

const options: NormalizeOptions = {};
for (let i = 0; i < rest.length; i += 2) {
  const flag = rest[i];
  const value = rest[i + 1];
  if (value === undefined) usage(`Option sans valeur : ${flag}`);
  if (flag === '--crop') {
    const [x, y, width, height] = value.split(',').map(Number);
    if ([x, y, width, height].some((n) => n === undefined || !Number.isInteger(n))) {
      usage(`--crop attend x,y,w,h entiers, reçu « ${value} ».`);
    }
    options.crop = { x: x!, y: y!, width: width!, height: height! };
  } else if (flag === '--key') {
    options.keyColor = parseInt(value.replace(/^#/, ''), 16);
    if (Number.isNaN(options.keyColor)) usage(`--key attend RRGGBB, reçu « ${value} ».`);
  } else {
    usage(`Option inconnue : ${flag}`);
  }
}

const source = readPng(input);
const { image, report } = normalizeSheet(source, proto, options);
const output = `public/sprites/${id}.png`;
writePng(output, image);

console.log(`${output} : ${report.width}×${report.height} (réduction ×${report.scale})`);
console.log(
  `  ${report.sourceColors} couleurs en entrée → ${report.paletteColors} de la palette ; ` +
    `dérive moyenne ${report.meanDrift.toFixed(1)} ; ${(report.coverage * 100).toFixed(0)} % opaque`,
);

const problems = verifySheet(image, proto);
if (problems.length > 0) {
  console.error('Vérification échouée :');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('  Vérification OK. Regarder l’image, puis renseigner SPRITES.' + id + '.file.');
