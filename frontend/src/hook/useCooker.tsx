import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as svc from '@/lib/services/cooker';
import { toastError, toastSuccess } from '@/components/ui/Toast';
import type { Restaurant } from '@/app/data/type';
import type { MembershipStatus, OperatingHour, Status as SchemaStatus } from '@/lib/schema';

export interface Cooker extends Restaurant {
    email: string;
    paymentQr: string;
    isTemporarilyClosed: boolean;
    isAutoAcceptedOrder: boolean;
    /** schema.prisma `Restaurant.status` (replaces `isApproved`): INACTIVE = waiting for the school to approve. */
    status?: SchemaStatus;
    canteenId?: string;
    location?: string | null;
    avgCookingTimeMins?: number | null;
    maxActiveOrders?: number | null;
    operatingHours?: OperatingHour[];
    contactName?: string;
    contactSurname?: string | null;
    contactTel?: string;
    contactEmail?: string;
    bankType?: string | null;
    accountName?: string;
    accountNumber?: string;
    /** Pre-migration fields – still returned until the backend finishes the schema move. */
    openTime?: string;
    closeTime?: string;
    avgCookingTime?: number;
    isApproved?: boolean;
    adminName?: string;
    adminSurname?: string;
    adminTel?: string;
    adminEmail?: string;
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

/* ───────── shop members: owner approves cooks ───────── */

const staffKey = (restaurantId: string) => ['staff', restaurantId] as const;

export const useStaff = (restaurantId: string, status?: MembershipStatus) =>
    useQuery({ queryKey: [...staffKey(restaurantId), status ?? 'all'], queryFn: () => svc.listStaff(restaurantId, status), enabled: !!restaurantId });

function useStaffMutation(restaurantId: string, fn: (id: string) => Promise<void>, ok: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: () => { toastSuccess(ok); queryClient.invalidateQueries({ queryKey: staffKey(restaurantId) }); },
        onError: (err) => toastError('ทำรายการไม่สำเร็จ', err),
    });
}

export const useApproveStaff = (restaurantId: string) => useStaffMutation(restaurantId, (id) => svc.approveStaff(restaurantId, id), 'อนุมัติเข้าร้านแล้ว');
export const useRejectStaff = (restaurantId: string) => useStaffMutation(restaurantId, (id) => svc.rejectStaff(restaurantId, id), 'ไม่อนุมัติแล้ว');
export const useRemoveStaff = (restaurantId: string) => useStaffMutation(restaurantId, (id) => svc.removeStaff(restaurantId, id), 'นำออกจากร้านแล้ว');

export type RestaurantSettingsPatch = Partial<{
    /** `null` clears the limit ("ไม่จำกัด"). */
    maxActiveOrders: number | null;
    avgCookingTimeMins: number;
    bankAccount: string;
    accountName: string;
    accountNumber: string;
}>;

/** Owner-only PATCH /restaurant/:id for the settings rows (kitchen limits and payout account). */
export function useUpdateRestaurantSettings(restaurantId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (patch: RestaurantSettingsPatch) => {
            await api.patch(`restaurant/${restaurantId}`, patch);
        },
        onSuccess: () => toastSuccess('บันทึกแล้ว'),
        onError: (err) => toastError('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', err),
        onSettled: () => queryClient.invalidateQueries({ queryKey: cookerQueryKey(restaurantId) }),
    });
}
