/** Money, the one way it's shown: whole dollars as "$48", otherwise "$53.50". */
export function formatPrice(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}
