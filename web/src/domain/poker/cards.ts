// Card model for the poker tools. A card is an int 0..51: rank*4 + suit,
// rank 0 = deuce … 12 = ace; suit 0..3 = clubs, diamonds, hearts, spades.

export type Card = number;

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'cdhs';
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];

export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;
export const makeCard = (rank: number, suit: number): Card => rank * 4 + suit;

/** "Ah" → card int; null for anything malformed or unknown. */
export function parseCard(text: string): Card | null {
  const t = text.trim();
  if (t.length !== 2) return null;
  const rank = RANK_CHARS.indexOf(t[0].toUpperCase());
  const suit = SUIT_CHARS.indexOf(t[1].toLowerCase());
  if (rank < 0 || suit < 0) return null;
  return makeCard(rank, suit);
}

export const cardText = (c: Card): string => `${RANK_CHARS[rankOf(c)]}${SUIT_CHARS[suitOf(c)]}`;
export const cardLabel = (c: Card): string => `${RANK_CHARS[rankOf(c)]}${SUIT_SYMBOLS[suitOf(c)]}`;

export const FULL_DECK: readonly Card[] = Object.freeze(
  Array.from({ length: 52 }, (_, i) => i),
);

/** Deterministic PRNG (mulberry32) so equity runs are reproducible/testable. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
