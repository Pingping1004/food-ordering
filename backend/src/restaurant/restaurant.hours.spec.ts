import { NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { RestaurantService } from './restaurant.service';
import { summarizeHours } from '../utils/hours.util';

const makePrisma = () => {
  const prisma: any = {
    restaurant: {
      findUnique: jest.fn(),
    },
    restaurantOperatingHour: {
      findMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
};

const build = (prisma: any) =>
  new RestaurantService(prisma, {} as any, {} as any, {} as any);

describe('Restaurant operating hours', () => {
  describe('getRestaurantHours', () => {
    it('returns sparse operating hours', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue({ restaurantId: 'r1' });
      prisma.restaurantOperatingHour.findMany.mockResolvedValue([
        {
          id: 'h1',
          restaurantId: 'r1',
          dayOfWeek: DayOfWeek.MONDAY,
          openMinute: 480,
          closeMinute: 960,
        },
        {
          id: 'h2',
          restaurantId: 'r1',
          dayOfWeek: DayOfWeek.TUESDAY,
          openMinute: 480,
          closeMinute: 960,
        },
      ]);

      const hours = await build(prisma).getRestaurantHours('r1');
      expect(hours).toEqual([
        { dayOfWeek: DayOfWeek.MONDAY, openMinute: 480, closeMinute: 960 },
        { dayOfWeek: DayOfWeek.TUESDAY, openMinute: 480, closeMinute: 960 },
      ]);
    });

    it('throws 404 if restaurant does not exist', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue(null);

      await expect(build(prisma).getRestaurantHours('r_none')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('saveRestaurantHours', () => {
    it('replaces all operating hours in a transaction', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue({ restaurantId: 'r1' });
      prisma.restaurantOperatingHour.findMany.mockResolvedValue([
        { dayOfWeek: DayOfWeek.MONDAY, openMinute: 500, closeMinute: 900 },
      ]);

      const res = await build(prisma).saveRestaurantHours('r1', [
        { dayOfWeek: DayOfWeek.MONDAY, openMinute: 500, closeMinute: 900 },
      ]);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.restaurantOperatingHour.deleteMany).toHaveBeenCalledWith({
        where: { restaurantId: 'r1' },
      });
      expect(prisma.restaurantOperatingHour.createMany).toHaveBeenCalledWith({
        data: [
          {
            restaurantId: 'r1',
            dayOfWeek: DayOfWeek.MONDAY,
            openMinute: 500,
            closeMinute: 900,
          },
        ],
      });
      expect(res).toEqual([
        { dayOfWeek: DayOfWeek.MONDAY, openMinute: 500, closeMinute: 900 },
      ]);
    });

    it('ignores invalid intervals (openMinute >= closeMinute)', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue({ restaurantId: 'r1' });
      prisma.restaurantOperatingHour.findMany.mockResolvedValue([]);

      await build(prisma).saveRestaurantHours('r1', [
        { dayOfWeek: DayOfWeek.MONDAY, openMinute: 900, closeMinute: 500 }, // invalid
      ]);

      expect(prisma.restaurantOperatingHour.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getHoursWindow', () => {
    it('returns summarized canteen hours when canteen has hours', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue({
        restaurantId: 'r1',
        canteen: {
          name: 'Main Canteen',
          operatingHours: [
            { dayOfWeek: DayOfWeek.MONDAY, openMinute: 420, closeMinute: 960 },
            { dayOfWeek: DayOfWeek.TUESDAY, openMinute: 420, closeMinute: 960 },
            { dayOfWeek: DayOfWeek.WEDNESDAY, openMinute: 420, closeMinute: 960 },
            { dayOfWeek: DayOfWeek.THURSDAY, openMinute: 420, closeMinute: 960 },
            { dayOfWeek: DayOfWeek.FRIDAY, openMinute: 420, closeMinute: 960 },
          ],
          school: {
            operatingHours: [],
          },
        },
      });

      const win = await build(prisma).getHoursWindow('r1');
      expect(win.label).toBe('จ.–ศ. 07:00–16:00');
    });

    it('falls back to default window when neither canteen nor school has hours', async () => {
      const prisma = makePrisma();
      prisma.restaurant.findUnique.mockResolvedValue({
        restaurantId: 'r1',
        canteen: {
          name: 'Main Canteen',
          operatingHours: [],
          school: {
            operatingHours: [],
          },
        },
      });

      const win = await build(prisma).getHoursWindow('r1');
      expect(win.label).toBe('ทุกวัน 06:00–18:00');
    });
  });

  describe('summarizeHours utility', () => {
    it('formats single day', () => {
      expect(
        summarizeHours([
          { dayOfWeek: DayOfWeek.MONDAY, openMinute: 600, closeMinute: 840 },
        ]),
      ).toBe('จ. 10:00–14:00');
    });

    it('formats closed all days', () => {
      expect(summarizeHours([])).toBe('ปิดทุกวัน');
    });

    it('formats weekdays with same time', () => {
      expect(
        summarizeHours([
          { dayOfWeek: DayOfWeek.MONDAY, openMinute: 480, closeMinute: 960 },
          { dayOfWeek: DayOfWeek.TUESDAY, openMinute: 480, closeMinute: 960 },
          { dayOfWeek: DayOfWeek.WEDNESDAY, openMinute: 480, closeMinute: 960 },
          { dayOfWeek: DayOfWeek.THURSDAY, openMinute: 480, closeMinute: 960 },
          { dayOfWeek: DayOfWeek.FRIDAY, openMinute: 480, closeMinute: 960 },
        ]),
      ).toBe('จ.–ศ. 08:00–16:00');
    });
  });
});
