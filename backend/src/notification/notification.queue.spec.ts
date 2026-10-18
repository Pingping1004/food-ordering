import { NotificationService } from './notification.service';

const makeService = (jobs: Array<{ orderId: string; userId: string; eventType: string }>) => {
  const prisma: any = {
    withRetry: (fn: () => unknown) => fn(),
    pushNotificationJob: { findMany: jest.fn().mockResolvedValue(jobs) },
  };
  const svc = new NotificationService(prisma, { get: () => undefined } as any, null);
  let inFlight = 0;
  let peak = 0;
  const done: string[] = [];
  (svc as any).dispatchJob = jest.fn(async (orderId: string) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    done.push(orderId);
  });
  return { svc, prisma, stats: () => ({ peak, done }) };
};

describe('push queue worker', () => {
  const jobs = Array.from({ length: 200 }, (_, i) => ({ orderId: `o${i}`, userId: 'u', eventType: 'new_order' }));

  it('should work through 200 due jobs in one tick with at most 5 in flight', async () => {
    const { svc, prisma, stats } = makeService(jobs);
    await svc.processPendingNotificationJobs();
    expect(stats().done).toHaveLength(200);
    expect(stats().peak).toBeLessThanOrEqual(5);
    expect(prisma.pushNotificationJob.findMany.mock.calls[0][0].take).toBe(200);
  });

  it('should skip a tick while the previous one is still running', async () => {
    const { svc, prisma } = makeService(jobs.slice(0, 20));
    const first = svc.processPendingNotificationJobs();
    await svc.processPendingNotificationJobs(); // overlaps: must return immediately
    await first;
    expect(prisma.pushNotificationJob.findMany).toHaveBeenCalledTimes(1);
  });

  it('should keep going when one push job fails, and still allow the next tick', async () => {
    const { svc } = makeService(jobs.slice(0, 10));
    let n = 0;
    (svc as any).dispatchJob = jest.fn(async () => { if (n++ === 3) throw new Error('fcm down'); });
    await expect(svc.processPendingNotificationJobs()).resolves.toBeUndefined();
    expect((svc as any).dispatchJob).toHaveBeenCalledTimes(10);
    await expect(svc.processPendingNotificationJobs()).resolves.toBeUndefined();
  });
});
