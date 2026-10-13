export interface Menu {
    menuId: string;
    name: string;
    menuImg: string;
    sellPriceDisplay: number;
    price: number;
    maxDaily: number;
    cookingTime: number;
    isAvailable: boolean;
    isOrderable: boolean;
    restaurantId: string;
  }
  
  export type CreateMenuInput = Omit<Menu, "menuId">;
