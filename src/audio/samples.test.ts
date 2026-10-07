import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SAMPLES, SampleBank, type SampleSpec } from './samples.ts';
import { SOUNDS, VOICES, type SoundName } from './synth.ts';

/** Un faux buffer : le chargeur ne regarde jamais dedans. */
function bufferOf(url: string): AudioBuffer {
  return { url } as unknown as AudioBuffer;
}

/** Une banque dont le réseau et le décodeur sont des fonctions de test. */
function bank(options: { missing?: (url: string) => boolean; undecodable?: (url: string) => boolean } = {}) {
  const fetched: string[] = [];
  const decoded: string[] = [];
  const samples = new SampleBank({
    base: '/sfx/',
    formats: ['ogg', 'm4a'],
    fetcher: (url) => {
      fetched.push(url);
      return Promise.resolve(options.missing?.(url) ? null : new TextEncoder().encode(url).buffer);
    },
    decode: (bytes) => {
      const url = new TextDecoder().decode(bytes);

      decoded.push(url);
      return options.undecodable?.(url) ? Promise.reject(new Error('EncodingError')) : Promise.resolve(bufferOf(url));
    },
  });

  return { samples, fetched, decoded };
}

const urlOf = (picked: { buffer: AudioBuffer } | null): string | undefined =>
  (picked?.buffer as unknown as { url: string } | undefined)?.url;

describe('échantillons', () => {
  it('rien avant le préchargement : la synthèse joue', () => {
    const { samples, fetched } = bank();

    expect(samples.pick('chop')).toBeNull();
    expect(fetched).toEqual([]);
  });

  it('charge chaque fichier une fois, même préchargé deux fois', async () => {
    const { samples, fetched } = bank();

    await Promise.all([samples.preload(), samples.preload()]);
    await samples.preload();

    const files = (Object.values(SAMPLES) as SampleSpec[]).flatMap((spec) => spec.files);

    expect(fetched).toHaveLength(files.length);
    expect(new Set(fetched).size).toBe(files.length);
    expect(fetched[0]).toBe('/sfx/chop_1.ogg');
  });

  it('tire une variante et une vitesse dans l’écart du son', async () => {
    const { samples } = bank();

    await samples.preload();

    const low = samples.pick('chop', () => 0);
    const high = samples.pick('chop', () => 0.999);

    expect(urlOf(low)).toBe('/sfx/chop_1.ogg');
    expect(urlOf(high)).toBe('/sfx/chop_3.ogg');
    expect(low?.rate).toBeCloseTo(1 - SAMPLES.chop.spread);
    expect(high?.rate).toBeCloseTo(1 + SAMPLES.chop.spread, 2);
    expect(samples.pick('horn', () => 0.9)?.rate).toBe(1);
    expect(low?.gain).toBe(SAMPLES.chop.gain);
  });

  it('passe au .m4a si le .ogg ne se décode pas', async () => {
    const { samples } = bank({ undecodable: (url) => url.endsWith('.ogg') });

    await samples.preload();

    expect(urlOf(samples.pick('horn'))).toBe('/sfx/horn.m4a');
  });

  it('retombe sur la synthèse si aucun encodage ne charge', async () => {
    const { samples } = bank({ missing: (url) => url.includes('/horn.') });

    await samples.preload();

    expect(samples.pick('horn')).toBeNull();
    expect(samples.pick('alarm')).not.toBeNull();
  });

  it('une variante manquante laisse jouer les autres', async () => {
    const { samples } = bank({ missing: (url) => url.includes('rock_2') });

    await samples.preload();

    const picks = [0, 0.5, 0.99].map((roll) => urlOf(samples.pick('rock', () => roll)));

    expect(picks).not.toContain('/sfx/rock_2.ogg');
    expect(picks.every((url) => url?.startsWith('/sfx/rock_'))).toBe(true);
  });

  it('chaque son a ses fichiers dans les deux encodages, et sa synthèse de repli', () => {
    for (const [name, spec] of Object.entries(SAMPLES) as [SoundName, SampleSpec][]) {
      expect(SOUNDS[name]).toBeTypeOf('function');
      for (const file of spec.files) {
        for (const ext of ['ogg', 'm4a']) expect(existsSync(`public/audio/sfx/${file}.${ext}`), `${file}.${ext}`).toBe(true);
      }
    }
  });

  it('un homme dit « Hé ho ! », une femme « Hé ! » : chacun ses trois prises', () => {
    expect(VOICES).toEqual({ male: 'heyHo', female: 'hey' });
    expect(SAMPLES.heyHo.files).toEqual(['heho_1', 'heho_2', 'heho_3']);
    expect(SAMPLES.hey.files).toEqual(['he_1', 'he_2', 'he_3']);
  });
});
