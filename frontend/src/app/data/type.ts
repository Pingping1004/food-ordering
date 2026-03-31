import { RestaurantCategory } from "@/components/users/RestaurantProfile";

export type Restaurant = {
    restaurantId: string;
    name: string;
    categories: RestaurantCategory[];
    restaurantImg: string;
    isActuallyOpen: boolean;
  };