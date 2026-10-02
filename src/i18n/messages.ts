/**
 * La forme d'un dictionnaire : celle du français, chaînes élargies en
 * `string`. Une fonction garde sa signature (un nombre à accorder, un nom à
 * glisser dans la phrase), une liste garde sa longueur quand c'est un tuple.
 */

import type { FR } from './fr/index.ts';

export type Translation<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Translation<R>
    : T extends readonly unknown[]
      ? { readonly [K in keyof T]: Translation<T[K]> }
      : T extends object
        ? { readonly [K in keyof T]: Translation<T[K]> }
        : T;

export type Messages = Translation<typeof FR>;
