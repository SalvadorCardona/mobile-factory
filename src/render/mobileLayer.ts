/**
 * Mutants, bêtes sauvages, flèches, enfants, Ève, ouvriers et butin.
 *
 * Les mobiles n'ont pas d'événement de création : ils apparaissent dans
 * `world.mobiles`, et cette couche s'y synchronise à chaque frame — une vue
 * par id présent, détruite dès que l'id ne l'est plus. Ils sont peu
 * nombreux, et c'est ce qui rend ce balayage acceptable là où il ne le
 * serait pas pour des tuiles.
 *
 * Les pantins vivent dans le conteneur trié de `EntityLayer` : un mutant
 * qui contourne la mairie passe derrière elle quand il est au-dessus, devant
 * quand il est en dessous — comme Adam.
 *
 * Une flèche traîne derrière elle trois segments blancs de plus en plus
 * effacés : on voit qui tire sur qui.
 *
 * Un mutant touché blanchit un éclair, recule dans l'axe du tir en
 * s'écrasant, fait la grimace (yeux en croix) et gicle ; un mutant de
 * vague sort d'une flaque vert fluo qui bouillonne, se hisse hors d'elle à
 * la fin de son émergence, et la flaque se résorbe derrière lui ; un mutant
 * qui meurt se tasse d'un coup et devient une flaque, qui se résorbe ; un
 * mutant qui fuit le jour, à l'aube, s'écrase et s'efface. Ce sont des minuteurs de vue : la simulation ne
 * connaît que ses points de vie. Crabes et loups font de même, et frappent
 * (pinces qui claquent, bond) quand ils touchent Adam.
 *
 * Ève arrive sur son vélo-cargo : tant qu'elle roule, sa vue est le vélo,
 * roues qui tournent et cadre qui cahote ; à pied, c'est son pantin, qui
 * frappe le mur qu'elle répare.
 *
 * La caravane de troc est une charrette tirée par son marchand : elle cahote
 * et sa roue tourne tant qu'elle roule ; garée, elle se tient immobile.
 *
 * Le butin qu'un ennemi lâche saute hors de lui, puis sautille au-dessus de
 * son ombre en attendant Adam, une étincelle éclosant de temps en temps à
 * son coin pour qu'il se repère ; il clignote quand il va disparaître.
 *
 * Le marqueur de cible — un anneau jaune au sol et une pointe au-dessus de
 * la tête — suit ce que l'arc d'Adam vise (`player.target`).
 *
 * Un ouvrier chez lui n'est pas dessiné ; dehors, il porte sa charge sur la
 * tête tant que son job est ramassé. Un ex-mutant a son propre pantin, un
 * logisticien aussi : sa charge dépasse de la caisse qu'il a au dos. Un
 * bûcheron abat sa hache sur l'arbre qu'il coupe, et rapporte son bois sur
 * la tête ; un forestier enfonce sa bêche là où il plante.
 *
 * Un enfant sautille : il court à petits bonds et saute sur place. Un
 * ouvrier qui glande (`World.isIdle`) et s'arrête prend une pose tirée au
 * hasard — assis, adossé, il s'étire, il bâille sous sa bulle « zzz » — et
 * se relève dès qu'il marche. Un enfant devenu ouvrier change de pantin.
 *
 * Un mutant assommé est affalé, trois étoiles en ronde au-dessus de la tête,
 * qui tournent plus vite quand il va se réveiller ; touché par Adam, il le
 * suit en boitillant ; en soins, il n'est pas dessiné.
 */

import { Container, Graphics, Sprite, type Texture, type Ticker } from 'pixi.js';
import { TILE_SIZE, floorDiv } from '../core/grid.ts';
import { PALETTE, hex } from '../data/artDirection.ts';
import { ENEMIES, LOOT_DROPS, WILDLIFE } from '../data/enemies.ts';
import { SPRITES } from '../data/sprites.ts';
import type { Mobile, MobileId, Mutant, Pickup } from '../sim/types.ts';
import { terrainAt } from '../sim/terrain.ts';
import { isDeprived } from '../sim/needs.ts';
import type { Inhabitant, Laborer, World } from '../sim/world.ts';
import { Puppet, type Lounge, type PuppetId } from './puppet.ts';
import type { SpriteLibrary } from './spriteLibrary.ts';
import type { TerrainTiles } from './terrainTiles.ts';

const HP_TRACK = hex(PALETTE.paper.base);
const HP_FG = hex(PALETTE.coral.base);
/** Largeur d'une barre de vie, en pixels monde ; celle de la Reine se lit de loin. */
const HP_WIDTH = 18;
const QUEEN_HP_WIDTH = 52;
/** La flaque de la Reine, agrandie d'autant : elle en sort tout entière. */
const QUEEN_PUDDLE = 2.6;

const SPAWN_MS = 500;
const DEATH_MS = 520;
/** Un mort se tasse (hauteur à `DEATH_FLAT`) en autant de ms, puis s'efface à plat. */
const DEATH_SQUASH_MS = 200;
const DEATH_FLAT = 0.2;
/** La flaque d'un mutant mort reste autant de ms avant de se résorber, à cette taille du vivant. */
const DEATH_PUDDLE_MS = 700;
const DEATH_PUDDLE_SIZE = 0.7;

/** La traînée d'une flèche : un segment tous les `TRAIL_STEP` px derrière l'empennage, de plus en plus effacé. */
const TRAIL_ALPHAS = [0.6, 0.35, 0.15] as const;
const TRAIL_FROM = -15;
const TRAIL_STEP = -7;

/** Un mutant touché recule de `RECOIL_PX` dans l'axe du tir et s'écrase (`RECOIL_SQUASH`), puis revient en `RECOIL_MS`. */
const RECOIL_MS = 140;
const RECOIL_PX = 3;
const RECOIL_SQUASH = 0.1;

/** Derniers ticks de l'émergence : le mutant se hisse hors de la flaque. */
const RISE_TICKS = 14;

/** La flaque s'étale en autant de ms, et se résorbe en autant. */
const PUDDLE_GROW_MS = 380;
const PUDDLE_FADE_MS = 900;

/** Bulles d'une flaque, et durée de vie d'une bulle, de sa naissance à son éclatement. */
const BUBBLES = 4;
const BUBBLE_MS = 620;

/** Le saut du butin qui tombe d'un ennemi, et son sautillement au sol. */
const LOOT_DROP_MS = 420;
const LOOT_HOP_PX = 3;

/** L'étincelle du butin : une éclosion de `LOOT_GLINT_MS` toutes les `LOOT_GLINT_PERIOD_MS`, au coin de l'icône. */
const LOOT_GLINT_PERIOD_MS = 1700;
const LOOT_GLINT_MS = 380;
const LOOT_GLINT_X = 6;
const LOOT_GLINT_Y = -16;
const LOOT_GLINT_SCALE = 0.55;

/** Sous ce nombre de ticks restants, le butin oublié clignote. */
const LOOT_BLINK_TICKS = 20 * 10;

/** Les étoiles d'un assommé : hauteur de la ronde au-dessus des pieds, aplatissement, vitesse (radians par ms). */
const STARS_Y = -24;
const STARS_FLAT = 0.45;
const STARS_SPIN = 0.004;
/** Sous ce nombre de ticks avant le réveil, les étoiles tournent deux fois plus vite. */
const STARS_HURRY_TICKS = 20 * 3;

/** Les glandes d'un ouvrier inactif, et combien de temps il en garde une : un minimum, plus une part tirée au hasard. */
const LOUNGES: readonly Lounge[] = ['sit', 'lean', 'stretch', 'yawn'];
const LOUNGE_MS = 2600;
const LOUNGE_JITTER_MS = 3200;

/** Le pantin de chaque marcheur : sprite, ombre, écart des pieds, allure. */
function puppetOf(
  mobile: Exclude<Mobile, { kind: 'arrow' | 'pickup' | 'caravan' }>,
): { id: PuppetId; shadowWidth: number; stride: number; gait?: 'scuttle' | 'limp' | 'hop' } {
  switch (mobile.kind) {
    case 'mutant':
      return mobile.proto === 'queen'
        ? { id: 'queen', shadowWidth: 72, stride: 12 }
        : { id: ENEMIES[mobile.proto].sprite, shadowWidth: 22, stride: 4 };
    case 'patient':
      return { id: 'patient', shadowWidth: 22, stride: 4, gait: 'limp' };
    case 'kid':
      return { id: 'kid', shadowWidth: 15, stride: 3, gait: 'hop' };
    case 'eve':
      return { id: 'eve', shadowWidth: 20, stride: 4 };
    case 'worker':
      if (mobile.logistician) return { id: 'logistician', shadowWidth: 17, stride: 3 };
      if (mobile.builder) return { id: 'builder', shadowWidth: 16, stride: 3 };
      return mobile.exMutant
        ? { id: 'exMutant', shadowWidth: 18, stride: 3.5 }
        : { id: 'worker', shadowWidth: 16, stride: 3 };
    case 'lumberjack':
      return { id: 'lumberjack', shadowWidth: 16, stride: 3 };
    case 'forester':
      return { id: 'forester', shadowWidth: 16, stride: 3 };
    case 'beast':
      return mobile.proto === 'crab'
        ? { id: WILDLIFE.crab.sprite, shadowWidth: 22, stride: 8, gait: 'scuttle' }
        : { id: WILDLIFE.wolf.sprite, shadowWidth: 26, stride: 3 };
  }
}

interface MobileView {
  root: Container;
  puppet: Puppet | null;
  /** Barre de vie d'un mutant entamé. */
  hp: Graphics | null;
  /** Points de vie au dernier cadre : une baisse déclenche la grimace. */
  lastHp: number;
  age: number;
  /** Tuile sous les pieds : l'ombre ne change de teinte qu'en changeant de sol. */
  tile: string;
  /** Le vélo-cargo d'Ève, montré tant qu'elle roule — ou la charrette de la caravane. */
  bike: BikeView | null;
  /** Les étoiles d'un patient : la ronde (aplatie) et l'étoile qui y tourne. */
  stars: { orbit: Container; spin: Sprite } | null;
  /** Taille du pantin : le gros mutant est un mutant en plus grand. */
  size: number;
  /** Taille de la flaque d'où il sort (`puddleSize`). */
  puddle: number;
  /** Le recul d'un mutant touché : direction du tir, ms restantes. */
  recoil: { dx: number; dy: number; left: number } | null;
  /** Ce qu'est le mobile : un enfant qui a 14 ans devient ouvrier sous le même id, et change de pantin. */
  kind: Mobile['kind'];
  /** La glande en cours d'un ouvrier inactif, et ses ms restantes avant d'en changer. */
  lounge: Lounge | null;
  loungeLeft: number;
  /** La bulle « affamé » d'un habitant à court de nourriture. */
  hungry: Sprite | null;
}

/** Le vélo-cargo — une ombre, le cadre avec Ève en selle, deux roues qui tournent — ou la charrette du marchand. */
interface BikeView {
  root: Container;
  shadow: Sprite;
  figure: Container;
  wheels: Sprite[];
  clock: number;
}

/** La flaque d'un mutant qui sort de terre : elle reste où il est apparu, et se résorbe après lui. */
interface Puddle {
  root: Container;
  pool: Sprite;
  bubbles: Sprite[];
  /** Taille de la mare : 1 pour une vague, plus petite sous un mort, bien plus grande sous la Reine. */
  size: number;
  /** Le mutant qui en sort — ou qui y est mort. */
  mutant: MobileId;
  age: number;
  /** Ms pendant lesquelles elle tient avant de se résorber : celle d'un mort reste un moment. */
  hold: number;
  /** Ms restantes avant de disparaître, une fois le mutant sorti ; `null` tant qu'il émerge. */
  fading: number | null;
}

/** Un mutant mort, qui s'écrase et s'efface là où il est tombé. */
interface Corpse {
  puppet: Puppet;
  left: number;
  /** Taille du vivant : le gros mutant s'écrase en gros. */
  scale: number;
}

export class MobileLayer {
  private readonly views = new Map<MobileId, MobileView>();
  private readonly corpses: Corpse[] = [];
  private readonly puddles: Puddle[] = [];

  private readonly world: World;
  private readonly library: SpriteLibrary;
  private readonly tiles: TerrainTiles;
  private readonly container: Container;

  /** Le marqueur de cible : anneau au sol, pointe au-dessus de la tête. */
  private readonly ring: Sprite;
  private readonly pointer: Sprite;
  private clock = 0;

  public constructor(world: World, library: SpriteLibrary, tiles: TerrainTiles, container: Container) {
    this.world = world;
    this.library = library;
    this.tiles = tiles;
    this.container = container;

    this.ring = new Sprite(library.part('target', 'ring'));
    this.pointer = new Sprite(library.part('target', 'pointer'));
    this.ring.anchor.set(SPRITES.target.anchorX, SPRITES.target.anchorY);
    this.pointer.anchor.set(0.5, 1);
    this.ring.visible = false;
    this.pointer.visible = false;
    container.addChild(this.ring, this.pointer);

    const fall = ({ id, x, y }: { id: number; x: number; y: number }): void => {
      const view = this.views.get(id);

      if (view?.puppet) {
        // La vue quitte la synchronisation : elle devient un corps qui s'efface.
        this.views.delete(id);
        view.hp?.destroy();
        view.root.destroy();
        // Un corps ne s'anime plus : son flash s'éteint ici, pas au prochain cadre.
        view.puppet.flash(0);
        view.puppet.root.position.set(x, y);
        view.puppet.root.zIndex = y;
        this.container.addChild(view.puppet.root);
        this.corpses.push({ puppet: view.puppet, left: DEATH_MS, scale: view.size });
      }
    };

    world.events.on('mutantDied', (event) => {
      const view = this.views.get(event.id);
      // Le gros mutant laisse une mare à sa taille, la Reine une mare à la sienne.
      const size = Math.max(view?.size ?? 1, view?.puddle ?? 1);

      fall(event);
      // Le mort devient une flaque, sous lui, qui se résorbe après lui.
      this.spill(event, size * DEATH_PUDDLE_SIZE, true);
    });
    // La Reine plonge : une flaque là où elle s'enfonce, une autre là où elle ressortira, près de la tour.
    world.events.on('queenDived', ({ id, x, y, toX, toY }) => {
      this.spill({ id, x, y }, QUEEN_PUDDLE);
      this.spill({ id, x: toX, y: toY }, QUEEN_PUDDLE);
    });
    world.events.on('mutantFled', fall);
    world.events.on('mutantHit', ({ id, dx, dy }) => {
      const view = this.views.get(id);

      if (!view?.puppet) return;
      view.puppet.flash();
      view.recoil = { dx, dy, left: RECOIL_MS };
    });
    world.events.on('beastDied', fall);
    world.events.on('playerHurt', ({ by }) => this.views.get(by)?.puppet?.strike());
  }

  public update(alpha: number, ticker: Ticker): void {
    const deltaMs = ticker.deltaMS;

    for (const mobile of this.world.mobiles.values()) {
      const stale = this.views.get(mobile.id);

      // Un enfant devenu ouvrier garde son id, pas son pantin.
      if (stale && stale.kind !== mobile.kind) this.drop(mobile.id, stale);

      const view = this.views.get(mobile.id) ?? this.add(mobile);
      const x = mobile.prevX + (mobile.x - mobile.prevX) * alpha;
      const y = mobile.prevY + (mobile.y - mobile.prevY) * alpha;

      view.root.position.set(x, y);

      switch (mobile.kind) {
        case 'arrow':
          view.root.rotation = Math.atan2(mobile.vy, mobile.vx);
          // Une flèche vole au-dessus de tout ce qui marche.
          view.root.zIndex = y + 64;
          break;

        case 'eve': {
          const riding = mobile.state === 'arriving';

          view.root.zIndex = y + 6;
          this.ground(view, x, y);
          view.puppet!.root.visible = !riding;
          view.bike!.root.visible = riding;

          if (riding) rideBike(view.bike!, mobile.facing === 'left', deltaMs);
          else view.puppet!.update(deltaMs, mobile.facing, mobile.working ? 'act' : mobile.moving ? 'walk' : 'idle');
          break;
        }

        case 'pickup':
          this.bob(view, mobile, y, deltaMs);
          break;

        case 'caravan': {
          const cart = view.bike!;

          view.root.zIndex = y + 6;
          this.ground(view, x, y);
          if (mobile.moving) rideBike(cart, mobile.facing === 'left', deltaMs);
          else cart.figure.y = 0;
          break;
        }

        case 'patient': {
          const puppet = view.puppet!;
          const stunned = mobile.state === 'stunned';
          const stars = view.stars!;

          view.root.zIndex = y + 6;
          view.root.visible = mobile.state !== 'care';
          this.ground(view, x, y);
          puppet.pose(stunned ? 'dazed' : null);
          stars.orbit.visible = stunned;
          if (stunned) stars.spin.rotation += deltaMs * STARS_SPIN * (mobile.ticks < STARS_HURRY_TICKS ? 2 : 1);
          puppet.update(deltaMs, stunned ? 'down' : mobile.facing, mobile.moving ? 'walk' : 'idle');
          break;
        }

        case 'lumberjack': {
          const puppet = view.puppet!;

          view.root.zIndex = y + 6;
          view.root.visible = !mobile.inside;
          this.ground(view, x, y);
          puppet.carry(mobile.load > 0 ? 'wood' : null);
          this.loiter(view, mobile, deltaMs);
          this.starve(view, mobile);
          puppet.update(deltaMs, view.lounge ? 'down' : mobile.facing, mobile.state === 'chop' ? 'act' : mobile.moving ? 'walk' : 'idle');
          break;
        }

        case 'forester': {
          const puppet = view.puppet!;

          view.root.zIndex = y + 6;
          view.root.visible = !mobile.inside;
          this.ground(view, x, y);
          this.loiter(view, mobile, deltaMs);
          this.starve(view, mobile);
          puppet.update(deltaMs, view.lounge ? 'down' : mobile.facing, mobile.state === 'plant' ? 'act' : mobile.moving ? 'walk' : 'idle');
          break;
        }

        case 'mutant':
        case 'beast':
        case 'kid':
        case 'worker': {
          const puppet = view.puppet!;

          view.root.zIndex = y + 6;
          this.ground(view, x, y);

          if (mobile.kind === 'worker') {
            view.root.visible = !mobile.inside;
            puppet.carry(mobile.job?.carried ? mobile.job.item : null);
            this.loiter(view, mobile, deltaMs);
          }
          if (mobile.kind === 'kid' || mobile.kind === 'worker') this.starve(view, mobile);

          if ((mobile.kind === 'mutant' || mobile.kind === 'beast') && view.hp) {
            const max = mobile.kind === 'mutant' ? ENEMIES[mobile.proto].hp : WILDLIFE[mobile.proto].hp;
            const queen = mobile.kind === 'mutant' && mobile.proto === 'queen';

            // La Reine porte sa barre dès qu'elle sort : on voit d'emblée ce qu'il faut user.
            view.hp.visible = queen || mobile.hp < max;
            if (view.hp.visible) drawHp(view.hp, mobile.hp / max, queen ? QUEEN_HP_WIDTH : HP_WIDTH);
            if (mobile.hp < view.lastHp) puppet.hit();
            view.lastHp = mobile.hp;

            if (mobile.kind === 'mutant' && mobile.emerge > 0) {
              this.rise(view, mobile, alpha);
            } else {
              view.root.scale.set(1);

              if (view.age < SPAWN_MS) {
                view.age = Math.min(SPAWN_MS, view.age + deltaMs);
                view.root.alpha = view.age / SPAWN_MS;
              }
            }
          }

          if (mobile.kind === 'mutant') this.recoil(view, deltaMs);

          // Un bâtisseur arrivé au chantier tape du marteau.
          const hammering = mobile.kind === 'worker' && mobile.build !== null && !mobile.moving;

          puppet.update(deltaMs, view.lounge ? 'down' : mobile.facing, mobile.moving ? 'walk' : hammering ? 'act' : 'idle');
          break;
        }
      }
    }

    for (const [id, view] of this.views) {
      if (this.world.mobiles.has(id)) continue;

      this.drop(id, view);
    }

    this.bury(deltaMs);
    this.bubble(deltaMs);
    this.mark(alpha, deltaMs);
  }

  /** La bulle « affamé » flotte au-dessus de la tête d'un habitant à court de nourriture. */
  private starve(view: MobileView, mobile: Inhabitant): void {
    const bubble = view.hungry!;

    bubble.visible = isDeprived(mobile.needs);
    if (bubble.visible) bubble.y = (mobile.kind === 'kid' ? -30 : -40) + Math.sin(this.clock * 0.004 + mobile.id) * 2;
  }

  /**
   * Un ouvrier qui glande (`World.isIdle`) et s'est arrêté prend une pose,
   * tirée au hasard, qu'il garde quelques secondes avant d'en changer : assis,
   * adossé, il s'étire, il bâille. Dès qu'il marche — il flâne, ou un
   * travail l'appelle —, il se relève.
   */
  private loiter(view: MobileView, mobile: Laborer, deltaMs: number): void {
    const puppet = view.puppet!;

    if (mobile.moving || !this.world.isIdle(mobile)) {
      view.lounge = null;
      view.loungeLeft = 0;
      puppet.lounge(null);
      return;
    }

    view.loungeLeft -= deltaMs;
    if (view.lounge === null || view.loungeLeft <= 0) {
      const choices = LOUNGES.filter((pose) => pose !== view.lounge);

      view.lounge = choices[Math.floor(Math.random() * choices.length)]!;
      view.loungeLeft = LOUNGE_MS + Math.random() * LOUNGE_JITTER_MS;
    }
    puppet.lounge(view.lounge);
  }

  /** Détruit la vue d'un mobile parti — ou qui a changé de nature. */
  private drop(id: MobileId, view: MobileView): void {
    view.puppet?.destroy();
    view.root.destroy({ children: true });
    this.views.delete(id);
  }

  /**
   * Un mutant qui émerge : invisible tant que la flaque bouillonne, puis il
   * se hisse — il grandit du sol et se matérialise sur les derniers ticks.
   */
  private rise(view: MobileView, mutant: Mutant, alpha: number): void {
    const left = Math.max(0, mutant.emerge - alpha);
    const t = 1 - Math.min(1, left / RISE_TICKS);

    // Sorti, il est déjà entier : pas de second fondu.
    view.age = SPAWN_MS;
    view.root.alpha = t;
    view.root.scale.set(0.7 + t * 0.3, 0.25 + t * 0.75);
  }

  /** Un mutant touché : repoussé dans l'axe du tir et écrasé, puis il revient. */
  private recoil(view: MobileView, deltaMs: number): void {
    const recoil = view.recoil;
    const root = view.puppet!.root;

    if (!recoil) return;

    recoil.left = Math.max(0, recoil.left - deltaMs);

    const t = recoil.left / RECOIL_MS;
    const size = view.size;

    root.position.set(recoil.dx * RECOIL_PX * t, recoil.dy * RECOIL_PX * t);
    root.scale.set(size * (1 + RECOIL_SQUASH * t), size * (1 - RECOIL_SQUASH * t));
    if (recoil.left === 0) view.recoil = null;
  }

  /**
   * Le butin : un saut hors de l'ennemi, puis un sautillement sur place où
   * une étincelle éclot de temps en temps ; il clignote avant de disparaître.
   */
  private bob(view: MobileView, pickup: Pickup, y: number, deltaMs: number): void {
    const icon = view.root.getChildAt(1);
    const glint = view.root.getChildAt(2);

    view.age += deltaMs;
    view.root.zIndex = y;

    const drop = Math.min(1, view.age / LOOT_DROP_MS);
    const hop = drop < 1 ? Math.sin(drop * Math.PI) * 14 : Math.abs(Math.sin(view.age / 260)) * LOOT_HOP_PX;

    icon.y = -hop;
    view.root.scale.set(0.4 + drop * 0.6);

    // Chaque butin a sa phase : ils ne scintillent pas tous ensemble.
    const phase = (view.age + pickup.id * 397) % LOOT_GLINT_PERIOD_MS;
    const bloom = drop < 1 || phase >= LOOT_GLINT_MS ? 0 : Math.sin((phase / LOOT_GLINT_MS) * Math.PI);

    glint.visible = bloom > 0;
    glint.y = LOOT_GLINT_Y - hop;
    glint.scale.set(bloom * LOOT_GLINT_SCALE);
    glint.rotation = (phase / LOOT_GLINT_MS) * 0.8;
    view.root.alpha = pickup.ttl < LOOT_BLINK_TICKS && Math.floor(view.age / 180) % 2 === 0 ? 0.35 : 1;
  }

  /** Les flaques bouillonnent tant que leur mutant émerge, puis se résorbent. */
  private bubble(deltaMs: number): void {
    for (let i = this.puddles.length - 1; i >= 0; i -= 1) {
      const puddle = this.puddles[i]!;
      const mutant = this.world.mobiles.get(puddle.mutant);

      puddle.age += deltaMs;

      if (puddle.fading === null && puddle.age >= puddle.hold && (mutant?.kind !== 'mutant' || mutant.emerge <= 0)) {
        puddle.fading = PUDDLE_FADE_MS;
      }

      const grow = Math.min(1, puddle.age / PUDDLE_GROW_MS);
      let size = 1 - (1 - grow) * (1 - grow);

      if (puddle.fading !== null) {
        puddle.fading = Math.max(0, puddle.fading - deltaMs);
        size *= puddle.fading / PUDDLE_FADE_MS;
      }

      // La mare respire un peu : elle bout.
      const breath = 1 + Math.sin(puddle.age / 110) * 0.04;

      puddle.pool.scale.set(size * breath * puddle.size, size * (2 - breath) * puddle.size);

      for (const [k, bubble] of puddle.bubbles.entries()) {
        const phase = ((puddle.age + (k * BUBBLE_MS) / BUBBLES) % BUBBLE_MS) / BUBBLE_MS;
        const spot = Math.sin(k * 2.4 + Math.floor((puddle.age + (k * BUBBLE_MS) / BUBBLES) / BUBBLE_MS) * 1.7);

        bubble.position.set(spot * 13 * size * puddle.size, Math.cos(k * 1.9) * 3 * size * puddle.size - phase * 5);
        // Elle gonfle, puis éclate d'un coup.
        bubble.scale.set(phase < 0.85 ? (0.4 + phase * 0.9) * size : 0);
        bubble.visible = puddle.fading === null || puddle.fading > PUDDLE_FADE_MS / 2;
      }

      if (puddle.fading === 0) {
        puddle.root.destroy({ children: true });
        this.puddles.splice(i, 1);
      }
    }
  }

  /**
   * Une flaque sous un mutant qui sort de terre, à l'endroit où il sort ; ou,
   * sans bulles, sous un mutant mort, qui reste un moment avant de se résorber.
   * `size` : la taille de la mare.
   */
  private spill(mutant: { id: MobileId; x: number; y: number }, size = 1, death = false): void {
    const { x, y } = mutant;
    const root = new Container();
    const pool = new Sprite(this.library.part('puddle', 'pool'));
    const bubbles: Sprite[] = [];

    pool.anchor.set(SPRITES.puddle.anchorX, SPRITES.puddle.anchorY);
    pool.scale.set(0);
    root.addChild(pool);

    for (let k = 0; k < (death ? 0 : BUBBLES); k += 1) {
      const bubble = new Sprite(this.library.part('puddle', 'bubble'));

      bubble.anchor.set(0.5);
      bubble.scale.set(0);
      bubbles.push(bubble);
      root.addChild(bubble);
    }

    root.position.set(x, y);
    // Au sol : sous le mutant qui en sort, sous tout ce qui passe devant.
    root.zIndex = y - 16;
    this.container.addChild(root);
    this.puddles.push({
      root,
      pool,
      bubbles,
      mutant: mutant.id,
      age: 0,
      hold: death ? DEATH_PUDDLE_MS : 0,
      size,
      fading: null,
    });
  }

  /** Pose le marqueur sur la cible de l'arc d'Adam, et le fait respirer. */
  private mark(alpha: number, deltaMs: number): void {
    const id = this.world.player.target;
    const target = id === null ? undefined : this.world.mobiles.get(id);
    const visible = target !== undefined && (target.kind === 'mutant' || target.kind === 'beast');

    this.ring.visible = visible;
    this.pointer.visible = visible;
    if (!visible) return;

    this.clock += deltaMs;

    const x = target.prevX + (target.x - target.prevX) * alpha;
    const y = target.prevY + (target.y - target.prevY) * alpha;
    const sprite = SPRITES[puppetOf(target).id];
    const breath = Math.sin(this.clock * 0.008);
    const head = y - sprite.height * sprite.anchorY + 4;

    this.ring.position.set(x, y);
    this.ring.scale.set(0.9 + breath * 0.06);
    this.ring.zIndex = y - 1;
    this.pointer.position.set(x, head - 2 + breath * 1.5);
    this.pointer.scale.set(0.6);
    this.pointer.zIndex = y + 64;
  }

  private add(mobile: Mobile): MobileView {
    const root = new Container();
    let view: MobileView;

    if (mobile.kind === 'arrow') {
      const sprite = new Sprite(this.library.part('arrow', 'fly'));

      // La traînée, de l'empennage vers l'arrière : la flèche tourne, elle suit.
      for (const [k, alpha] of TRAIL_ALPHAS.entries()) {
        const trail = new Sprite(this.library.part('arrow', 'trail'));

        trail.anchor.set(SPRITES.arrow.anchorX, SPRITES.arrow.anchorY);
        trail.x = TRAIL_FROM + k * TRAIL_STEP;
        trail.alpha = alpha;
        root.addChild(trail);
      }
      sprite.anchor.set(SPRITES.arrow.anchorX, SPRITES.arrow.anchorY);
      root.addChild(sprite);
      view = { root, puppet: null, hp: null, lastHp: 0, age: SPAWN_MS, tile: '', bike: null, stars: null, size: 1, puddle: 1, recoil: null, kind: mobile.kind, lounge: null, loungeLeft: 0, hungry: null };
    } else if (mobile.kind === 'pickup') {
      const tx = floorDiv(mobile.x, TILE_SIZE);
      const ty = floorDiv(mobile.y, TILE_SIZE);
      const shadow = new Sprite(this.tiles.shadow(terrainAt(this.world.seed, tx, ty)));
      const icon = new Sprite(this.library.part('loot', mobile.item));
      const glint = new Sprite(this.library.part('loot', 'glint'));

      shadow.anchor.set(0.5);
      shadow.width = 16;
      shadow.height = 6;
      icon.anchor.set(SPRITES.loot.anchorX, SPRITES.loot.anchorY);
      glint.anchor.set(0.5);
      glint.x = LOOT_GLINT_X;
      glint.visible = false;
      root.addChild(shadow, icon, glint);
      // Butin rechargé d'une sauvegarde : déjà posé, pas de saut.
      const fresh = LOOT_DROPS.lifetimeTicks - mobile.ttl < 20;

      view = { root, puppet: null, hp: null, lastHp: 0, age: fresh ? 0 : LOOT_DROP_MS, tile: '', bike: null, stars: null, size: 1, puddle: 1, recoil: null, kind: mobile.kind, lounge: null, loungeLeft: 0, hungry: null };
    } else if (mobile.kind === 'caravan') {
      const cart = this.cart(this.tiles.shadow('grass'));

      // Rechargée garée, elle garde le sens où elle roulait.
      cart.figure.scale.x = mobile.facing === 'left' ? -1 : 1;
      root.addChild(cart.root);
      view = { root, puppet: null, hp: null, lastHp: 0, age: SPAWN_MS, tile: '', bike: cart, stars: null, size: 1, puddle: 1, recoil: null, kind: mobile.kind, lounge: null, loungeLeft: 0, hungry: null };
    } else {
      const foe = mobile.kind === 'mutant' || mobile.kind === 'beast';
      const { id, ...options } = puppetOf(mobile);
      const puppet = new Puppet(this.library, id, this.tiles.shadow('grass'), options);
      // Le gros mutant est un mutant en plus grand, ombre comprise.
      const scale = mobile.kind === 'mutant' ? ENEMIES[mobile.proto].scale : 1;
      let hp: Graphics | null = null;

      puppet.root.scale.set(scale);
      root.addChild(puppet.root);

      const bike = mobile.kind === 'eve' ? this.bike(this.tiles.shadow('grass')) : null;

      if (bike) root.addChild(bike.root);

      if (foe) {
        const proto = SPRITES[id];

        hp = new Graphics();
        hp.position.set(-(id === 'queen' ? QUEEN_HP_WIDTH : HP_WIDTH) / 2, -proto.height * proto.anchorY * scale - 2);
        hp.visible = false;
        root.addChild(hp);
        root.alpha = 0;
      }
      const stars = mobile.kind === 'patient' ? this.stars() : null;

      if (stars) root.addChild(stars.orbit);

      let hungry: Sprite | null = null;

      if (mobile.kind === 'kid' || mobile.kind === 'worker' || mobile.kind === 'lumberjack' || mobile.kind === 'forester') {
        hungry = new Sprite(this.library.part('hungry', 'bubble'));
        hungry.anchor.set(SPRITES.hungry.anchorX, SPRITES.hungry.anchorY);
        hungry.visible = false;
        root.addChild(hungry);
      }
      const puddle = mobile.kind === 'mutant' ? puddleSize(mobile) : 1;

      view = { root, puppet, hp, lastHp: foe ? mobile.hp : 0, age: foe ? 0 : SPAWN_MS, tile: '', bike, stars, size: scale, puddle, recoil: null, kind: mobile.kind, lounge: null, loungeLeft: 0, hungry };
      if (mobile.kind === 'mutant' && mobile.emerge > 0) this.spill(mobile, puddle);
    }

    this.views.set(mobile.id, view);
    this.container.addChild(view.root);
    return view;
  }

  /** L'ombre portée prend la teinte du sol sous les pieds. */
  private ground(view: MobileView, x: number, y: number): void {
    const tx = floorDiv(x, TILE_SIZE);
    const ty = floorDiv(y, TILE_SIZE);
    const key = `${tx},${ty}`;

    if (key === view.tile || (!view.puppet && !view.bike)) return;
    view.tile = key;
    view.puppet?.setShadow(this.tiles.shadow(terrainAt(this.world.seed, tx, ty)));
    if (view.bike) view.bike.shadow.texture = this.tiles.shadow(terrainAt(this.world.seed, tx, ty));
  }

  /** Les étoiles d'un assommé : une ronde aplatie en ellipse, l'étoile tourne dedans. */
  private stars(): { orbit: Container; spin: Sprite } {
    const { width, height, pivots } = SPRITES.patient;
    const [px, py] = pivots.stars;
    const orbit = new Container();
    const spin = new Sprite(this.library.part('patient', 'stars'));

    spin.anchor.set(px / width, py / height);
    orbit.addChild(spin);
    orbit.position.set(0, STARS_Y);
    orbit.scale.set(1, STARS_FLAT);
    return { orbit, spin };
  }

  /** Le vélo-cargo, morceaux posés pour que le cadre du sprite tombe sur l'ancre commune. */
  private bike(shadowTexture: Texture): BikeView {
    const { width, height, anchorX, anchorY, pivots } = SPRITES.cargoBike;
    const root = new Container();
    const figure = new Container();
    const shadow = new Sprite(shadowTexture);
    const frame = new Sprite(this.library.part('cargoBike', 'frame'));
    const wheels = (['wheelBack', 'wheelFront'] as const).map((name) => {
      const wheel = new Sprite(this.library.part('cargoBike', name));
      const [px, py] = pivots[name];

      wheel.anchor.set(px / width, py / height);
      wheel.position.set(px - anchorX * width, py - anchorY * height);
      return wheel;
    });

    shadow.anchor.set(0.5);
    shadow.width = 54;
    shadow.height = 10;
    shadow.position.set(3, 1);
    frame.anchor.set(anchorX, anchorY);
    figure.addChild(...wheels, frame);
    root.addChild(shadow, figure);
    return { root, shadow, figure, wheels, clock: 0 };
  }

  /** La charrette du marchand : son ombre, la caisse et le marchand, la roue qui tourne. */
  private cart(shadowTexture: Texture): BikeView {
    const { width, height, anchorX, anchorY, pivots } = SPRITES.caravan;
    const root = new Container();
    const figure = new Container();
    const shadow = new Sprite(shadowTexture);
    const body = new Sprite(this.library.part('caravan', 'cart'));
    const wheel = new Sprite(this.library.part('caravan', 'wheel'));
    const [px, py] = pivots.wheel;

    wheel.anchor.set(px / width, py / height);
    wheel.position.set(px - anchorX * width, py - anchorY * height);
    shadow.anchor.set(0.5);
    shadow.width = 70;
    shadow.height = 12;
    shadow.position.set(2, 1);
    body.anchor.set(anchorX, anchorY);
    figure.addChild(body, wheel);
    root.addChild(shadow, figure);
    return { root, shadow, figure, wheels: [wheel], clock: 0 };
  }

  /** Les morts se tassent en `DEATH_SQUASH_MS`, puis s'effacent à plat. */
  private bury(deltaMs: number): void {
    for (let i = this.corpses.length - 1; i >= 0; i -= 1) {
      const corpse = this.corpses[i]!;

      corpse.left = Math.max(0, corpse.left - deltaMs);

      // Il se tasse d'un coup, puis s'efface à plat.
      const elapsed = DEATH_MS - corpse.left;
      const flat = Math.min(1, elapsed / DEATH_SQUASH_MS);
      const root = corpse.puppet.root;

      root.scale.set(corpse.scale * (1 + flat * 0.5), corpse.scale * (1 - flat * (1 - DEATH_FLAT)));
      root.alpha = flat < 1 ? 1 : corpse.left / (DEATH_MS - DEATH_SQUASH_MS);

      if (corpse.left === 0) {
        corpse.puppet.destroy();
        this.corpses.splice(i, 1);
      }
    }
  }

  public destroy(): void {
    for (const view of this.views.values()) {
      view.puppet?.destroy();
      view.root.destroy({ children: true });
    }
    for (const corpse of this.corpses) corpse.puppet.destroy();
    for (const puddle of this.puddles) puddle.root.destroy({ children: true });
    this.views.clear();
    this.corpses.length = 0;
    this.puddles.length = 0;
  }
}

/** Les roues tournent, le cadre cahote ; à gauche, le vélo se retourne. */
function rideBike(bike: BikeView, left: boolean, deltaMs: number): void {
  bike.clock += deltaMs;
  bike.figure.scale.x = left ? -1 : 1;
  bike.figure.y = -Math.abs(Math.sin(bike.clock * 0.02)) * 0.8;
  for (const wheel of bike.wheels) wheel.rotation += deltaMs * 0.012;
}

/** Une capsule blanche et son remplissage corail, au-dessus de la tête. */
export function drawHp(graphics: Graphics, ratio: number, width = HP_WIDTH): void {
  graphics.clear().roundRect(0, 0, width, 6, 3).fill(HP_TRACK);
  if (ratio > 0) graphics.roundRect(1.5, 1.5, Math.max(3, (width - 3) * ratio), 3, 1.5).fill(HP_FG);
}

/** La taille de la flaque d'où sort un mutant : celle d'un mutant, plus petite pour une larve, bien plus grande pour la Reine. */
function puddleSize(mutant: Mutant): number {
  return mutant.proto === 'queen' ? QUEEN_PUDDLE : Math.min(1, ENEMIES[mutant.proto].scale);
}
