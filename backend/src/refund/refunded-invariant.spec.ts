import * as fs from 'fs';
import * as path from 'path';

/**
 * Product rule: PromptServe moves no money. `PaymentStatus.REFUNDED` may only ever be written by the shop's
 * explicit `mark_refunded` action in refund.service.ts. If anything else starts assigning it (a webhook,
 * a cron, an auto-approve), this test fails.
 */
describe('PaymentStatus.REFUNDED invariant', () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory()
        ? walk(p)
        : p.endsWith('.ts') && !p.endsWith('.spec.ts')
          ? [p]
          : [];
    });

  it('should be written from exactly one place: refund.service mark_refunded', () => {
    const writers = walk(path.join(__dirname, '..'))
      .filter((f) =>
        /paymentStatus\s*:\s*(PaymentStatus\.)?['"]?REFUNDED/.test(
          fs.readFileSync(f, 'utf8'),
        ),
      )
      .map((f) => path.relative(path.join(__dirname, '..'), f));
    expect(writers).toEqual(['refund/refund.service.ts']);
  });

  it('should only be written inside the mark_refunded branch', () => {
    const src = fs.readFileSync(
      path.join(__dirname, 'refund.service.ts'),
      'utf8',
    );
    const idx = src.indexOf('PaymentStatus.REFUNDED');
    const before = src.slice(Math.max(0, idx - 400), idx);
    expect(before).toContain("dto.action === 'mark_refunded'");
  });
});
