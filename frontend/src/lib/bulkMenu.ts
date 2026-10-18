export type BulkRow = {
    id: string;
    name: string;
    price: string;
};

export const BULK_DEFAULTS = { cookingTimeMins: "5", maxDaily: "30" } as const;

let seq = 0;
export const newRowId = () =>
    `r${Date.now().toString(36)}${(seq++).toString(36)}`;
export const emptyRow = (): BulkRow => ({
    id: newRowId(),
    name: "",
    price: "",
});

export const isBlankRow = (r: BulkRow) => !r.name.trim() && !r.price.trim();
export const isValidPrice = (p: string) =>
    /^\d+$/.test(p.trim()) && Number(p) >= 1;
export const isRowComplete = (r: BulkRow) =>
    r.name.trim().length > 0 && isValidPrice(r.price);

/** "ข้าวผัดกุ้ง 60", "ข้าวผัดกุ้ง ..... 60.-", "ต้มยำ 80 บาท" -> name + price. A line with no price keeps an empty price. */
export function parseMenuLine(line: string): Pick<BulkRow, "name" | "price"> {
    const m = line
        .trim()
        .match(/^(.+?)[\s.\-–:]*?(\d{1,4})(?:\s*(?:บาท|฿|\.-|-))?$/);
    return m
        ? { name: m[1].replace(/[\s.\-–:]+$/, ""), price: m[2] }
        : { name: line.trim(), price: "" };
}

export const normalizeName = (name: string) =>
    name.trim().toLowerCase().replace(/\s+/g, " ");

/** Ids of rows whose name repeats an earlier row in the same batch (the server rejects the whole batch on duplicates). */
export function duplicateRowIds(rows: BulkRow[]): Set<string> {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const r of rows) {
        const key = normalizeName(r.name);
        if (!key) continue;
        if (seen.has(key)) dup.add(r.id);
        else seen.add(key);
    }
    return dup;
}
