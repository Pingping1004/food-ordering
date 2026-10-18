import { DayOfWeek } from '@prisma/client';

export const DAYS: { key: DayOfWeek; short: string; long: string }[] = [
  { key: DayOfWeek.MONDAY, short: 'จ.', long: 'จันทร์' },
  { key: DayOfWeek.TUESDAY, short: 'อ.', long: 'อังคาร' },
  { key: DayOfWeek.WEDNESDAY, short: 'พ.', long: 'พุธ' },
  { key: DayOfWeek.THURSDAY, short: 'พฤ.', long: 'พฤหัสบดี' },
  { key: DayOfWeek.FRIDAY, short: 'ศ.', long: 'ศุกร์' },
  { key: DayOfWeek.SATURDAY, short: 'ส.', long: 'เสาร์' },
  { key: DayOfWeek.SUNDAY, short: 'อา.', long: 'อาทิตย์' },
];

export function minutesToHHmm(m: number | null | undefined): string {
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function formatRange(
  open: number | null | undefined,
  close: number | null | undefined,
): string {
  return open == null || close == null
    ? 'ปิด'
    : `${minutesToHHmm(open)}–${minutesToHHmm(close)}`;
}

export function summarizeHours(
  hours: { dayOfWeek: DayOfWeek; openMinute: number; closeMinute: number }[],
): string {
  if (!hours || !hours.length) return 'ปิดทุกวัน';
  const ordered = DAYS.map((d) => hours.find((h) => h.dayOfWeek === d.key)).map(
    (h, i) => ({ h, d: DAYS[i] }),
  );
  const groups: { from: number; to: number; range: string }[] = [];
  ordered.forEach(({ h }, i) => {
    if (!h) return;
    const range = formatRange(h.openMinute, h.closeMinute);
    const last = groups[groups.length - 1];
    if (last && last.to === i - 1 && last.range === range) last.to = i;
    else groups.push({ from: i, to: i, range });
  });
  return groups
    .map(
      (g) =>
        `${g.from === g.to ? DAYS[g.from].short : `${DAYS[g.from].short}–${DAYS[g.to].short}`} ${g.range}`,
    )
    .join(' · ');
}
