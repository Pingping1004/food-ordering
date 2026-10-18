import { FixedWindowLimiter } from './fixed-window-limiter';

describe('FixedWindowLimiter', () => {
  it('should allow up to the limit then block with a positive retry-after', () => {
    const l = new FixedWindowLimiter(3, 60_000);
    const t = 1_000_000;
    expect([1, 2, 3].map(() => l.hit('u', t).allowed)).toEqual([true, true, true]);
    const blocked = l.hit('u', t + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(50);
  });

  it('should reset after the window elapses', () => {
    const l = new FixedWindowLimiter(1, 1_000);
    expect(l.hit('u', 0).allowed).toBe(true);
    expect(l.hit('u', 500).allowed).toBe(false);
    expect(l.hit('u', 1_000).allowed).toBe(true);
  });

  it('should keep users independent', () => {
    const l = new FixedWindowLimiter(1, 60_000);
    expect(l.hit('a', 0).allowed).toBe(true);
    expect(l.hit('b', 0).allowed).toBe(true);
    expect(l.hit('a', 1).allowed).toBe(false);
  });

  it('should stay bounded when flooded with distinct keys', () => {
    const l = new FixedWindowLimiter(5, 60_000, 100);
    for (let i = 0; i < 10_000; i++) l.hit(`k${i}`, 0);
    expect((l as any).windows.size).toBeLessThanOrEqual(100);
  });
});
