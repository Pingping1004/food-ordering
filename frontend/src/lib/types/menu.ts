import type { Menu as SchemaMenu } from "@/lib/schema";

/**
 * `Menu` as the API returns it. Core fields follow schema.prisma (`price` is whole baht, `cookingTimeMins`);
 * the optional ones are pre-migration names that older responses may still carry.
 */
export type Menu = Pick<SchemaMenu, "menuId" | "name" | "price" | "isAvailable" | "restaurantId"> & {
    menuImg: string | null;
    maxDaily: number | null;
    cookingTimeMins: number;
    /** @deprecated use `cookingTimeMins` */
    cookingTime?: number;
    /** @deprecated the schema has a single `price` */
    sellPriceDisplay?: number;
    /** @deprecated derived from `isAvailable` + inventory server-side */
    isOrderable?: boolean;
};

export type CreateMenuInput = Omit<Menu, "menuId">;

export const sellPriceOf = (m: Pick<Menu, "price" | "sellPriceDisplay">) => m.sellPriceDisplay ?? m.price;
export const cookingMinsOfMenu = (m: Pick<Menu, "cookingTimeMins" | "cookingTime">) => m.cookingTimeMins ?? m.cookingTime ?? 0;
export const isMenuOrderable = (m: Pick<Menu, "isAvailable" | "isOrderable">) => m.isOrderable ?? m.isAvailable;

/** Menus created without a photo store `menuImg = null`; older rows may still hold the shared fallback picture. */
const LEGACY_FALLBACK_IMG_URL = "https://images.promptserve.online/picture.webp";
export const hasMenuPhoto = (menuImg?: string | null): menuImg is string => !!menuImg && menuImg !== LEGACY_FALLBACK_IMG_URL;
