/**
 * Planche de relecture : tous les visuels du jeu sur une seule image.
 *
 *   npm run art:sheet -- planche.svg [échelle]
 *
 * Écrit un SVG où chaque morceau de chaque sprite, chaque tuile de sol,
 * chaque icône est posé sur l'herbe, agrandi, avec son nom. C'est ce qu'on
 * regarde avant de valider un visuel (cf. le skill `art-direction`) : pour
 * l'ouvrir avec `Read`, le convertir en PNG avec Chrome sans interface —
 *
 *   google-chrome --headless --screenshot=planche.png --window-size=L,H planche.svg
 *
 * (L et H sont affichés à la fin). Outil de Node : il lit les SVG en chaînes,
 * sans navigateur.
 */

import { writeFileSync } from 'node:fs';
import { GROUND_TILES, cornerTile, edgeTile, shadowTile } from '../art/terrain.ts';
import { UI_ICONS } from '../art/ui.ts';
import { GROUND, PALETTE, type Ground } from '../data/artDirection.ts';
import { ITEM_ICONS } from '../data/icons.ts';
import { SPRITES, SPRITE_IDS, type SpriteProto } from '../data/sprites.ts';

interface Cell {
  label: string;
  svg: string;
  width: number;
  height: number;
}

const [output = 'planche.svg', scaleArg = '3'] = process.argv.slice(2);
const scale = Number(scaleArg);
const COLUMNS = 8;
const GAP = 16;
const LABEL = 18;

function sizeOf(svg: string): [number, number] {
  const match = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);

  return match ? [Number(match[1]), Number(match[2])] : [32, 32];
}

function cell(label: string, svg: string): Cell {
  const [width, height] = sizeOf(svg);

  return { label, svg, width, height };
}

const sections: [string, Cell[]][] = [
  [
    'Sprites',
    SPRITE_IDS.flatMap((id) =>
      Object.entries((SPRITES[id] as SpriteProto).parts).map(([part, svg]) => cell(`${id}.${part}`, svg)),
    ),
  ],
  [
    'Sol',
    (Object.keys(GROUND) as Ground[]).flatMap((ground) => [
      ...GROUND_TILES[ground].map((svg, i) => cell(`${ground}.${i}`, svg)),
      ...(['top', 'bottom'] as const).flatMap((side) => {
        const svg = edgeTile(ground, side);

        return svg ? [cell(`${ground}.bord-${side}`, svg)] : [];
      }),
      cell(`${ground}.coin`, cornerTile(GROUND[ground].base, 'tl')),
      cell(`${ground}.ombre`, shadowTile(ground)),
    ]),
  ],
  [
    'Icônes',
    [
      ...Object.entries(ITEM_ICONS).map(([item, svg]) => cell(`objet.${item}`, svg)),
      ...Object.entries(UI_ICONS).map(([name, svg]) => cell(`ui.${name}`, svg)),
    ],
  ],
];

let y = GAP;
let width = 0;
const body: string[] = [];

for (const [title, cells] of sections) {
  body.push(`<text x="${GAP}" y="${y + 22}" font-family="sans-serif" font-size="22" fill="${PALETTE.ink.base}">${title}</text>`);
  y += 36;

  for (let start = 0; start < cells.length; start += COLUMNS) {
    const row = cells.slice(start, start + COLUMNS);
    const rowHeight = Math.max(...row.map((c) => c.height * scale)) + LABEL;
    let x = GAP;

    for (const c of row) {
      const w = Math.max(c.width * scale, 120);

      body.push(
        `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${rowHeight + 4}" rx="8" fill="${GROUND.grass.base}"/>`,
        `<g transform="translate(${x} ${y}) scale(${scale})">${c.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`,
        `<text x="${x}" y="${y + rowHeight - 4}" font-family="sans-serif" font-size="13" fill="${PALETTE.ink.base}">${c.label}</text>`,
      );
      x += w + GAP;
    }
    width = Math.max(width, x);
    y += rowHeight + GAP;
  }
}

const sheet =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}">` +
  `<rect width="100%" height="100%" fill="${PALETTE.paper.base}"/>${body.join('')}</svg>`;

writeFileSync(output, sheet);
console.log(`${output} : ${width} × ${y}`);
