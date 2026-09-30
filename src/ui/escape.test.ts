import { describe, expect, it } from 'vitest';
import { escapeAction, type EscapeState } from './escape.ts';

const NOTHING: EscapeState = { paused: false, menuOpen: false, panelOpen: false, inventoryOpen: false };

describe('escapeAction', () => {
  it('rien d’ouvert : pause', () => {
    expect(escapeAction(NOTHING)).toBe('pause');
  });

  it('en pause : la pause se lève, même avec une fenêtre derrière', () => {
    expect(escapeAction({ ...NOTHING, paused: true })).toBe('resume');
    expect(escapeAction({ ...NOTHING, paused: true, panelOpen: true })).toBe('resume');
  });

  it('le menu de construction ouvert se ferme', () => {
    expect(escapeAction({ ...NOTHING, menuOpen: true })).toBe('closeMenu');
  });

  it('la fenêtre d’un bâtiment (ou du labo) se ferme, sans pause', () => {
    expect(escapeAction({ ...NOTHING, panelOpen: true })).toBe('closePanel');
  });

  it('le sac se ferme, sans pause', () => {
    expect(escapeAction({ ...NOTHING, inventoryOpen: true })).toBe('closeInventory');
  });
});
