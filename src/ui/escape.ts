/**
 * Ce que fait Échap : fermer ce qui est au premier plan, sinon basculer la pause.
 *
 * Le voile de la pause couvre tout : en pause, Échap la lève, et ce qui était
 * ouvert derrière le reste. Hors pause, il ferme d'abord le menu de
 * construction, puis la fenêtre d'un bâtiment (celle du labo comprise) ou le
 * sac — les deux ne sont jamais ouverts ensemble. Rien d'ouvert : pause.
 *
 * Fonction pure, sans DOM : `main.ts` l'applique, les tests la lisent.
 */

/** Ce qui est ouvert à l'écran quand Échap tombe. */
export interface EscapeState {
  paused: boolean;
  menuOpen: boolean;
  panelOpen: boolean;
  inventoryOpen: boolean;
}

export type EscapeAction = 'resume' | 'closeMenu' | 'closePanel' | 'closeInventory' | 'pause';

export function escapeAction(state: EscapeState): EscapeAction {
  if (state.paused) return 'resume';
  if (state.menuOpen) return 'closeMenu';
  if (state.panelOpen) return 'closePanel';
  if (state.inventoryOpen) return 'closeInventory';
  return 'pause';
}
