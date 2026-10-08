/**
 * Le shader de l'eau : un seul programme pour toute l'eau visible.
 *
 * Il lit le champ du bloc (`waterField.ts` : niveau, profondeur, tremblé de
 * la rive, retard du ressac) et une petite texture de bruit qui se répète
 * (`ripplesTexture`), qu'il fait glisser ; trois lectures de texture et un
 * peu de calcul par pixel, pas de bruit calculé. Il peint, au pixel près et
 * sans grille :
 *
 * - la **rive** : là où le niveau passe ½, déplacé de quelques pixels par un
 *   bruit fixe — un bord rond, un peu irrégulier, jamais une marche. Hors de
 *   l'eau, le pixel est jeté : le sable baké dessous se montre ;
 * - la **profondeur** : du turquoise clair contre le sable (`shallow`) au
 *   bleu du fond (`deep`) en passant par l'eau franche (`base`), sur la
 *   distance à la rive — un dégradé continu ;
 * - l'**écume** : une bande blanche qui suit la rive et respire en
 *   `SURF_PERIOD` secondes — elle monte un peu sur le sable puis se retire,
 *   déphasée le long du bord ; une ligne de ressac arrive du large, fond dans
 *   la bande et s'efface ;
 * - les **crêtes** : quelques arcs clairs, un pour trois cellules de 3 × 3
 *   tuiles environ, à une place, une taille et un rythme tirés de la seed ;
 *   chacun naît en fondu, dérive avec le vent et s'efface, puis renaît
 *   ailleurs dans sa cellule ;
 * - l'**ondulation** : deux bruits lents qui se croisent éclaircissent à
 *   peine la surface par plaques — un reflet qui bouge, très discret.
 *
 * GLSL ES 3.0 (`#version 300 es`) : `fwidth` y est natif, il antialiase
 * chaque bord à la taille du pixel, quel que soit le zoom.
 *
 * Tout tourne sur `uTime`, le temps de rendu en secondes, jamais sur le tick
 * de la simulation. Les couleurs sont celles de `GROUND` : le shader ne
 * connaît aucune couleur à lui.
 */

import { RIPPLE_LATTICE } from './waterField.ts';

/**
 * Les commentaires restent dans ce fichier, en français : le GPU ne reçoit
 * que le code, en ASCII — certains pilotes mobiles refusent un accent, même
 * dans un commentaire.
 */
function glsl(source: string): string {
  return source.replace(/\/\/.*$/gm, '');
}

/** Période du ressac, en secondes : l'écume monte et se retire une fois par période. */
export const SURF_PERIOD = 3;

export const WATER_VERTEX = glsl(`#version 300 es
in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;
out vec2 vWorld;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;

  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vWorld = aPosition;
}
`);

export const WATER_FRAGMENT = glsl(`#version 300 es
in vec2 vUV;
in vec2 vWorld;

out vec4 finalColor;

uniform sampler2D uField;
uniform sampler2D uRipples;

uniform float uTime;
uniform vec2 uSeed;
uniform vec3 uShallow;
uniform vec3 uBase;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec3 uCrest;

const float PI = 3.14159265;
const float TILE = 32.0;
const float SURF_PERIOD = ${SURF_PERIOD.toFixed(1)};
const float CREST_CELL = 3.0;
const float RIPPLE_LATTICE = ${RIPPLE_LATTICE.toFixed(1)};

float hash(vec2 p) {
  p = fract((p + uSeed) * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

// Le bruit des ondulations, 0 à 1, lu dans sa texture qui se répète : une maille par unité de p.
float ripple(vec2 p) {
  return texture(uRipples, p / RIPPLE_LATTICE).r;
}

// Une crête : un arc clair dans sa cellule, de 0 à 1 ; px est la taille d'un pixel, en tuiles.
float crest(vec2 tile, float t, float px) {
  vec2 cell = floor(tile / CREST_CELL);

  if (hash(cell + 31.7) > 0.4) return 0.0;

  float life = 5.0 + 3.0 * hash(cell + 5.1);
  float age = t / life + hash(cell + 9.3);
  float cycle = floor(age);
  float k = age - cycle;
  // Chaque vie renaît ailleurs dans sa cellule, loin des bords.
  vec2 spot = vec2(hash(cell + cycle * 1.37 + 2.0), hash(cell + cycle * 2.11 + 4.0));
  float radius = 0.45 + 0.25 * hash(cell + cycle * 0.71 + 7.0);
  // Elle dérive avec le vent, vers la droite, en s'étirant un peu.
  vec2 centre = (cell + 0.3 + spot * 0.4) * CREST_CELL + vec2(0.45, -0.1) * (k - 0.5);
  // L'arc est le haut d'un cercle centré dessous : bombé vers la lumière, effilé aux deux bouts.
  vec2 d = tile - centre - vec2(0.0, radius * 0.75);
  float ring = abs(length(d) - radius);
  float span = smoothstep(0.5, 0.9, -d.y / radius);
  float width = 0.07 * span;

  return (1.0 - smoothstep(width - px, width + px, ring)) * span * sin(PI * k);
}

void main() {
  vec4 field = texture(uField, vUV);
  vec2 tile = vWorld / TILE;
  float t = uTime;
  // Un pixel d'écran, en tuiles : l'antialiasing des tracés qui ne suivent pas un champ continu.
  float px = max(length(fwidth(tile)) * 0.5, 0.0001);

  // La rive : un bruit fixe la décale de quelques pixels — elle ondule sans suivre la grille.
  float level = field.r + (field.b - 0.5) * 0.22;
  float aa = max(fwidth(level), 0.0001);

  // Le ressac : une phase par endroit, qui court le long de la rive.
  float phase = fract(t / SURF_PERIOD + field.a * 0.8);
  float breath = 0.5 + 0.5 * cos(2.0 * PI * phase);
  float shore = 0.5 - 0.035 * breath;
  float wet = smoothstep(shore - aa, shore + aa, level);

  if (wet <= 0.0) discard;

  float depth = field.g;
  vec3 color = mix(mix(uShallow, uBase, smoothstep(0.05, 0.4, depth)), uDeep, smoothstep(0.4, 1.0, depth));

  // L'ondulation : deux bruits lents qui se croisent ; là où ils montent ensemble,
  // un reflet net, à peine plus clair, qui change de forme en glissant.
  vec2 drift = vec2(t * 0.09, t * 0.035);
  float swell = ripple(tile * 0.9 + drift) + ripple(mat2(0.8, -0.6, 0.6, 0.8) * tile * 1.3 - drift.yx * 1.4 + 9.0);
  float sheen = fwidth(swell);
  float open = smoothstep(0.2, 0.45, depth);

  color = mix(color, uCrest, smoothstep(1.42 - sheen, 1.42 + sheen, swell) * 0.1 * open);

  // Les crêtes du large, loin de l'écume.
  color = mix(color, uCrest, crest(tile, t, px) * open * 0.9);

  // La ligne de ressac arrive du large et fond dans l'écume.
  float line = abs(level - mix(0.8, 0.6, phase));
  float wave = (1.0 - smoothstep(0.018 - aa, 0.018 + aa, line)) * sin(PI * phase);

  color = mix(color, uFoam, wave * 0.7);

  // L'écume : une bande contre la rive, déchirée par un bruit, plus large quand la mer monte.
  float edge = 0.57 + 0.04 * breath + (ripple(tile * 3.0 + vec2(t * 0.15, 0.0)) - 0.5) * 0.05;
  float foam = 1.0 - smoothstep(edge - aa, edge + aa, level);

  color = mix(color, uFoam, foam);

  finalColor = vec4(color * wet, wet);
}
`);
