/** Section `panel` du dictionnaire anglais. */

import type { Messages } from '../messages.ts';

/** Le pluriel anglais : seul 1 est au singulier. */
const s = (count: number): string => (count === 1 ? '' : 's');

export const panel: Messages['panel'] = {
  about: 'About',
  blocked: 'Stuck: chest full. Bump into it or tap Take all.',
  paused: 'Paused: nothing goes in or out. Tap Resume.',
  /** A producer stopped by a full chest: the map's alert bubble, explained. */
  storeFull: 'Storage full: production has stopped. Empty it or build a logistics post nearby.',
  transferButton: 'Transfer',
  transferBag: 'Transfer bag',
  cancelSite: 'Cancel site',
  cancelConfirm: 'Really cancel?',
  pause: 'Pause',
  resume: 'Resume',
  maxLevel: 'Max level',
  hp: (value: string): string => `Health: ${value}`,

  tabs: {
    label: 'Window tabs',
    building: 'Building',
    inventory: 'Inventory',
  },

  site: {
    allDelivered: 'All delivered: the builders are on their way to build it.',
    building: (builders: number, percent: number): string => `${builders} builder${s(builders)} hammering away — ${percent}%`,
    byYard: 'The construction post builders bring supplies from the town hall, then build it.',
    comeCloser: 'Under construction — come closer to deliver.',
    transferOrBump: 'Under construction — transfer your bag, or bump into it.',
    workers: (count: number): string => `Workers it will employ: ${count}`,
    coverage: {
      bag: 'Your bag has enough: transfer to finish it.',
      town: 'The town stock covers the rest: transfer to finish it.',
      both: 'Bag and town cover the rest: transfer to finish it.',
      short: 'Under construction — transfer bag and town, or bump into it.',
    },
    needDone: (item: string, delivered: number, needed: number): string => `${item}: ${delivered}/${needed}, all delivered`,
    needDelivered: (item: string, delivered: number, needed: number): string => `${item}: ${delivered}/${needed} delivered`,
    needIncoming: (count: number): string => `${count} on the way`,
    needTownEmpty: 'none left in town',
    needInTown: (count: number): string => `${count} in town`,
  },

  repair: {
    noStock: (item: string, hp: number): string => `Damaged — bring some ${item.toLowerCase()} to fix it (1 = ${hp} HP).`,
    damaged: (item: string, hp: number): string =>
      `Damaged — repair it, or bump into it with ${item.toLowerCase()} in your bag (1 = ${hp} HP).`,
    button: (amount: number, item: string): string => `Repair (${amount} ${item.toLowerCase()})`,
  },

  chest: {
    town: 'Town chest',
    plain: 'Chest',
    label: (count: string): string => `Chest ${count}`,
    emptyLabel: (label: string): string => `${label}: empty`,
    empty: 'empty',
  },

  townHall: {
    adults: (count: number): string => `Adults: ${count}`,
    children: (count: number): string => `Children: ${count}`,
    workers: (count: number): string => `Workers: ${count}`,
    nights: (count: number): string => `Nights survived: ${count}`,
    radius: (tiles: number): string => `Supply radius: sites within ${tiles} tiles draw from its chest`,
  },

  drill: {
    extracts: (item: string): string => `Extracting: ${item}`,
    dry: 'Built on dry ground: no deposit underneath.',
    running: 'Running.',
  },

  nursery: {
    perBirth: (recipe: string): string => `Each birth eats ${recipe}.`,
    hungry: (why: string): string => `Waiting for a meal. ${why}`,
    next: (time: string): string => `Next child in ${time}`,
    full: 'Full: the next child waits for an older one to go to work.',
    nextAdult: (time: string): string => `Next worker in ${time}`,
    noKids: 'No children here yet.',
    kids: (count: number, capacity: number): string => `Children in the nursery: ${count} of ${capacity}`,
    born: (count: number): string => `Children born here: ${count}`,
  },

  forge: {
    noOne: 'Stopped: nobody at the furnace. Add a worker.',
    starved: (why: string): string => `Stopped. ${why}`,
    heating: 'The furnace is heating up.',
  },

  tower: {
    range: (weapon: string, tiles: number): string => `${weapon} — range: ${tiles} tiles`,
    alert: 'On alert: mutants incoming.',
    idle: 'On watch.',
  },

  farm: {
    noOne: 'Stopped: nobody in the fields. Add a worker.',
    growing: 'The furrows are sprouting.',
  },

  quarry: {
    noOne: 'Stopped: nobody cutting stone. Add a worker.',
    working: 'Pickaxes chipping away at the ruin.',
  },

  well: {
    noOne: 'Stopped: nobody at the winch. Add a worker.',
    working: 'The bucket comes up full.',
  },

  house: {
    sleeping: 'The workers sleep here between shifts.',
    beds: 'Whoever has no bed finds one here, the closest to their work.',
    bedsTaken: (used: number, beds: number): string => `Beds taken: ${used}/${beds}`,
  },

  lumberCamp: {
    radius: (tiles: number): string => `Radius: lumberjacks fell trees within ${tiles} tiles`,
    paused: 'Paused: the lumberjacks bring back their wood, then loaf around.',
    noOne: 'Stopped: no lumberjack. Add a worker.',
    noTrees: 'No trees left in range.',
    working: 'Axes ringing out.',
  },

  foresterHouse: {
    saplings: (count: number): string => `${count} sapling${s(count)} growing`,
    trees: (count: number): string => `${count} grown tree${s(count)}, ready to cut`,
    free: (count: number): string => `${count} free tile${s(count)} to plant`,
    plot: (side: number): string => `Forest: a ${side} × ${side} square around the house.`,
    paused: 'Paused: the forester puts down the spade and loafs around.',
    noOne: 'Stopped: no forester. Add a worker. Nothing gets planted.',
    toPlot: 'The forester is heading to the next tile.',
    planting: 'The forester is putting a sapling in the ground.',
    asleep: 'The forester is asleep and will replant tomorrow.',
    seeking: 'The forester is looking for a free tile.',
    full: 'Forest complete: the forester will replant whatever the lumberjacks cut.',
    nowhere: 'No tile to plant here: water, rock, roads or buildings.',
  },

  depot: {
    radius: (tiles: number): string => `Radius: logisticians empty producers within ${tiles} tiles`,
    none: 'No producer in range: they loaf around.',
    served: (count: number): string => `${count} producer${s(count)} in range: output goes to the town hall.`,
  },

  yard: {
    radius: (tiles: number): string => `Radius: builders supply and build sites within ${tiles} tiles`,
    paused: 'Paused: its sites go back to the porters and to you.',
    noOne: 'Stopped: no builder. Add a worker.',
    none: 'No site in range: they loaf around.',
    served: (count: number): string => `${count} site${s(count)} in range: the builders are on it.`,
  },

  antenna: {
    floor: (level: number, max: number): string => `Floor ${level}/${max}`,
    nextFloor: 'The next floor is delivered like a site: transfer, bump into it, or let the porters do it.',
    signalSent: 'The Signal is out: survivors arrive every dawn.',
    lureNight: (night: number): string => `On night ${night}, every wave will march on it.`,
    lureTonight: 'Tonight, every wave is marching on it.',
  },

  enemyBase: {
    level: (level: number): string => `Level ${level}`,
    zone: (tiles: number): string => `Held zone: no harvesting or building within ${tiles} tiles`,
    required: (gear: string, level: number): string => `Required gear: ${gear} (level ${level})`,
    weak: 'You need better gear: your arrows do nothing to it. Forge a better bow at the forge.',
    ready: 'Your bow can damage it: get closer, it shoots on its own.',
    prestige: (amount: number): string => `Destroyed, it gives ${amount} Prestige and frees its zone.`,
    raiders: (count: number, capacity: number): string => `Raiders in reserve: ${count} of ${capacity}`,
    guards: (count: number, max: number): string => `Guards: ${count} of ${max}`,
    raid: 'By day it breeds raiders; at nightfall they all march on the town.',
    asleep: (night: number): string => `It sends its first raiders only on night ${night}.`,
  },

  gear: {
    current: (gear: string, level: number): string => `Your bow: ${gear} (level ${level})`,
    next: (gear: string, level: number): string => `Forge: ${gear} — damages level ${level} bases`,
    button: 'Forge the bow',
    best: 'You have the best bow.',
    comeCloser: ' — get closer.',
  },

  clinic: {
    beds: (used: number, beds: number): string => `Beds taken: ${used}/${beds}`,
    full: 'Full: defeated mutants no longer drop stunned for it.',
    open: 'A defeated mutant may drop stunned — touch it and it will follow you here.',
  },

  creature: {
    age: (years: number): string => `${years} year${s(years)} old — one more at every dawn`,
    role: {
      porter: 'Porter',
      logistician: 'Logistician',
      builder: 'Builder',
      lumberjack: 'Lumberjack',
      forester: 'Forester',
      child: 'Child',
      exMutant: 'Ex-mutant, porter',
      survivor: 'Survivor, porter',
    },
    home: (building: string): string => `Works for: ${building}`,
    homeless: 'No job',
    sleepsIn: (building: string): string => `Sleeps at: ${building}`,
    sleepsOutside: 'Sleeps at: outside, no bed',
    carrying: (load: string): string => `Carrying: ${load}`,
    emerging: 'Crawling out of its puddle',
    marchesOn: (building: string): string => `Marching on: ${building}`,
    beast: {
      roam: 'Roaming around its den',
      chase: 'Charging Adam!',
      return: 'Heading back to its den',
    },
  },

  crew: {
    less: 'One worker fewer',
    more: 'One worker more',
    missing: (count: number): string => `${count} worker${s(count)} missing: the post fills up as soon as someone is free.`,
    none: 'No workers: the building is stopped.',
    assigned: (filled: number, returned: number): string =>
      `${filled} worker${s(filled)} assigned` + (returned > 0 ? `, ${returned} sent back to town.` : '.'),
  },

  upgrade: {
    effect: (action: string, effect: string): string => `${action}: ${effect}`,
    comeCloser: ' — come closer.',
    lacking: (count: number): string => `${count} short`,
    hp: (from: number, to: number): string => `HP ${from} → ${to}`,
    range: (from: number, to: number): string => `range ${from} → ${to}`,
    rate: (percent: number): string => `fire rate ${percent > 0 ? '+' : ''}${percent}%`,
  },

  starved: {
    coming: (item: string): string => `${item}: the porters are bringing it.`,
    inTown: (item: string, count: number): string => `${item} in town: ${count} — the porters are coming.`,
    noPorter: (item: string, count: number, inRange: boolean): string =>
      `${item} in town: ${count} — no porter: ${inRange ? 'transfer it' : 'bring it over'}.`,
    inBag: (item: string): string => `${item} in your bag — bump into it or transfer.`,
    nowhere: (item: string): string => `No ${item.toLowerCase()} anywhere — go gather some.`,
  },

  recipeAmount: (amount: number, item: string): string => `${amount} ${item.toLowerCase()}`,
  duration: (minutes: number, seconds: number): string =>
    minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, '0')} s` : `${seconds} s`,

  transfer: {
    quantity: 'Amount per tap',
    all: 'All',
    bag: 'Adam’s bag',
    takeAll: 'Take all',
    depositAll: 'Deposit all',
    empty: 'Empty',
    reserved: (count: number): string => `${count} reserved`,
    comeCloser: 'Come closer to the building to trade items.',
    bagFull: 'Bag full: deposit before taking.',
    nothingFits: 'Nothing in your bag fits this chest right now.',
  },

  placement: {
    locked: 'You don’t have the blueprint',
    terrain: 'Not on water',
    occupied: 'Tile taken',
    onPlayer: 'You are standing on the spot',
    outOfReach: 'Too far — come closer',
    unique: 'Only one per colony',
    noOre: { text: 'No ore vein here', remedy: 'Break a rock, then place the drill where it stood' },
    road: { text: 'A road runs here', remedy: 'Remove it first: Build › Road › Remove' },
    nearHall: { text: 'Too close to the town hall', remedy: 'Move away, outside the circle around it' },
    treesAndRocks: { text: 'Trees and rocks in the way', remedy: 'Adam can harvest them' },
    rocks: { text: 'Rocks in the way', remedy: 'Adam can break them' },
    rock: { text: 'A rock is in the way', remedy: 'Adam can break it' },
    trees: { text: 'Trees in the way', remedy: 'Adam can chop them' },
    tree: { text: 'A tree is in the way', remedy: 'Adam can chop it' },
    enemyZone: { text: 'A mutant base holds this zone', remedy: 'Take it down with a bow of its level' },
    extracts: (item: string): string => `Will extract: ${item}`,
    roads: {
      noStone: { text: 'Out of stone for the rest', remedy: 'Break some rocks, or draw within the town hall radius' },
      terrain: { text: 'Not on water', remedy: '' },
      occupied: { text: 'A building is on the path', remedy: '' },
      resource: { text: 'A tree or rock is in the way', remedy: 'Adam can harvest it' },
      enemyZone: { text: 'A mutant base holds the zone', remedy: 'Take it down with a bow of its level' },
    },
  },
};
