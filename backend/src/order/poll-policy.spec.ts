import { OrderStatus, PaymentStatus } from '@prisma/client';
import { pollAfterSeconds, pollScale, type PollState } from './poll-policy';

const o = (
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  accepted = false,
): PollState => ({
  status,
  paymentStatus,
  acceptAt: accepted ? new Date() : null,
});

describe('pollAfterSeconds (X-Poll-After)', () => {
  const OLD = process.env.POLL_INTERVAL_SCALE;
  afterEach(() => {
    if (OLD === undefined) delete process.env.POLL_INTERVAL_SCALE;
    else process.env.POLL_INTERVAL_SCALE = OLD;
  });

  it.each([
    ['waiting for the shop, no push', o('receive', 'UNPAID'), false, 5],
    ['waiting for the shop, push on', o('receive', 'UNPAID'), true, 10],
    ['accepted, waiting for payment', o('receive', 'UNPAID', true), false, 20],
    [
      'slip being checked',
      o('receive', 'PENDING_VERIFICATION', true),
      false,
      20,
    ],
    ['cooking', o('cooking', 'PAID', true), false, 15],
    ['delayed', o('delay', 'PAID', true), false, 15],
    ['ready for pickup', o('ready', 'PAID', true), false, 10],
    ['picked up', o('done', 'PAID', true), false, 0],
    ['rejected', o('rejected', 'UNPAID'), false, 0],
    [
      'cancelled (payment window closed)',
      o('receive', 'CANCELLED', true),
      false,
      0,
    ],
    ['refunded', o('cooking', 'REFUNDED', true), false, 0],
  ] as const)('%s → %i s', (_label, state, push, expected) => {
    expect(pollAfterSeconds(state, push)).toBe(expected);
  });

  it('should slow every client by POLL_INTERVAL_SCALE, within 3–60 s, and never restart a finished order', () => {
    process.env.POLL_INTERVAL_SCALE = '2';
    expect(pollAfterSeconds(o('receive', 'UNPAID'), false)).toBe(10);
    expect(pollAfterSeconds(o('cooking', 'PAID', true), false)).toBe(30);
    expect(pollAfterSeconds(o('done', 'PAID', true), false)).toBe(0);
    process.env.POLL_INTERVAL_SCALE = '10';
    expect(pollAfterSeconds(o('receive', 'UNPAID', true), false)).toBe(60);
    process.env.POLL_INTERVAL_SCALE = '0.1';
    expect(pollAfterSeconds(o('receive', 'UNPAID'), false)).toBe(3);
  });

  it('should ignore a missing or invalid scale', () => {
    expect(pollScale(undefined)).toBe(1);
    expect(pollScale('abc')).toBe(1);
    expect(pollScale('-2')).toBe(1);
    expect(pollScale('1.5')).toBe(1.5);
  });
});
