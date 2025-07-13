import Decimal from "decimal.js";

export function numberRound(num: Decimal | number): Decimal {
    const input = num instanceof Decimal ? num : new Decimal(num);
    const fractionalPart = input.minus(input.floor());
    const threshold = new Decimal('0.4');

    return fractionalPart.greaterThan(threshold) ? input.ceil() : input.floor();
}