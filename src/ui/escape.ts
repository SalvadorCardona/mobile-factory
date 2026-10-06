/**
 * Ce que fait Échap : fermer ce qui est au premier plan, sinon basculer la pause.
 *
 * Le menu des réglages passe avant tout : ouvert, Échap le ferme. Le voile
 * de la pause couvre le reste : en pause, Échap la lève, et ce qui était
 * ouvert derrière le reste. Hors pause, il ferme d'abord la carte du monde,
 * qui couvre tout l'écran, puis le menu de
 * construction, puis la fenêtre d'un bâtiment (celle du labo comprise) ou le
 * sac — les deux ne sont jamais ouverts ensemble. Rien d'ouvert : pause.
 *
 * Fonction pure, sans DOM : `main.ts` l'applique, les tests la lisent.
 */

/** Ce qui est ouvert à l'écran quand Échap tombe. */
export interface EscapeState {
  settingsOpen: boolean;
  paused: boolean;
  mapOpen: boolean;
  menuOpen: boolean;
  panelOpen: boolean;
  inventoryOpen: boolean;
}

export type EscapeAction = 'closeSettings' | 'resume' | 'closeMap' | 'closeMenu' | 'closePanel' | 'closeInventory' | 'pause';

export function escapeAction(state: EscapeState): EscapeAction {
  if (state.settingsOpen) return 'closeSettings';
  if (state.paused) return 'resume';
  if (state.mapOpen) return 'closeMap';
  if (state.menuOpen) return 'closeMenu';
  if (state.panelOpen) return 'closePanel';
  if (state.inventoryOpen) return 'closeInventory';
  return 'pause';
}
