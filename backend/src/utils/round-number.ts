import Decimal from "decimal.js";

export function numberRound(num: Decimal): Decimal {
    const fractionalPart = num.minus(num.floor());
    const threshold = new Decimal('0.4');

    if (fractionalPart.greaterThan(threshold)) {
        return num.ceil();
    } else {
        return num.floor();
    }
}