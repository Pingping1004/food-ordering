import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Restaurant } from '@/app/data/type';

export interface Cooker extends Restaurant {
    email: string;
    adminName: string;
    adminSurname: string;
    adminTel: string;
    adminEmail: string;
    paymentQr: string;
    openTime: string;
    closeTime: string;
    avgCookingTime: number;
    isTemporarilyClosed: boolean;
    isAutoAcceptedOrder: boolean;
    isApproved: boolean;
}

function cookerQueryKey(restaurantId: string) {
    return ['cooker', restaurantId] as const;
}

export function useCooker(restaurantId: string) {
    return useQuery<Cooker>({
        queryKey: cookerQueryKey(restaurantId),
        queryFn: async () => {
            const res = await api.get<Cooker>(`restaurant/${restaurantId}`, {
            });
            return res.data;
        },
        staleTime: 8 * 60 * 1000,
        enabled: !!restaurantId,
    });
}

export function useCreateRestaurant() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post<{ result: Cooker }>('/restaurant', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data.result;
        },
        onSuccess: (cooker) => {
            queryClient.setQueryData(cookerQueryKey(cooker.restaurantId), cooker);
        },
    });
}

export function useToggleRestaurantClosed(restaurantId: string) {
    const queryClient = useQueryClient();
    const queryKey = cookerQueryKey(restaurantId);
  
    return useMutation({
      mutationFn: async (isTemporarilyClosed: boolean) => {
        const res = await api.patch(`restaurant/temporarily-close/${restaurantId}`, {
          isTemporarilyClosed,
        });
        return res.data as Pick<Cooker, 'isTemporarilyClosed'>;
      },
      onMutate: async (isTemporarilyClosed) => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData<Cooker>(queryKey);
        queryClient.setQueryData<Cooker>(queryKey, (prev) =>
          prev ? { ...prev, isTemporarilyClosed } : prev
        );
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(queryKey, ctx?.previous);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    });
}

export function useToggleRestaurantAutoAccept(restaurantId: string) {
    const queryClient = useQueryClient();
    const queryKey = cookerQueryKey(restaurantId);
  
    return useMutation({
      mutationFn: async (isAutoAcceptedOrder: boolean) => {
        const res = await api.patch(`restaurant/auto-accepted/${restaurantId}`, {
            isAutoAcceptedOrder,
        });
        return res.data as Pick<Cooker, 'isAutoAcceptedOrder'>;
      },
      onMutate: async (isAutoAcceptedOrder) => {
        await queryClient.cancelQueries({ queryKey });

        const previous = queryClient.getQueryData<Cooker>(queryKey);
        
        queryClient.setQueryData<Cooker>(queryKey, (prev) =>
          prev ? { ...prev, isAutoAcceptedOrder } : prev
        );

        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(queryKey, ctx?.previous);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    });
}