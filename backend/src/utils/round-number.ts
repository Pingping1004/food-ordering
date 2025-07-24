import Decimal from 'decimal.js';

export function numberRound(num: Decimal | number): Decimal {
  const input = num instanceof Decimal ? num : new Decimal(num);
  const fractionalPart = input.minus(input.floor());
  const threshold = new Decimal('0.4');

  const rounded = fractionalPart.greaterThan(threshold)
    ? input.ceil()
    : input.toDecimalPlaces(2, Decimal.ROUND_DOWN);
  return new Decimal(rounded).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
