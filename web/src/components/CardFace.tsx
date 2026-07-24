// Renders a playing card's rank + suit symbol, honoring the user's deck
// color setting: classic two-color (hearts/diamonds red) or four-color
// (spades neutral, hearts red, diamonds blue, clubs green). Use this
// anywhere cards are displayed so the setting applies app-wide.
import { Card, cardLabel, suitOf } from '../domain/poker/cards';
import { useAppState } from '../hooks/useAppState';

// Suit order in the card model: 0 clubs, 1 diamonds, 2 hearts, 3 spades.
const FOUR_COLOR_CLASS = ['card-club', 'card-diamond', 'card-red', ''];
const TWO_COLOR_CLASS = ['', 'card-red', 'card-red', ''];

export function CardFace({ card }: { card: Card }) {
  const { settings } = useAppState();
  const classes = settings.deckColors === 'FOUR' ? FOUR_COLOR_CLASS : TWO_COLOR_CLASS;
  return <span className={classes[suitOf(card)] || undefined}>{cardLabel(card)}</span>;
}
