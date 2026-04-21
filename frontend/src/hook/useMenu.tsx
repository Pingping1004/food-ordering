import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Menu, CreateMenuInput } from "@/lib/types/menu";

type CreateMenuPayload = {
  formData: FormData;
  optimistic: CreateMenuInput;
}

type UpdateMenuPayload = {
  menuId: string;
  formData: FormData;
  optimistic: Partial<Menu>;
};

function menuQueryKey(restaurantId: string) {
  return ["menus", restaurantId] as const;
}

export function useMenus(restaurantId: string) {
  return useQuery<Menu[]>({
    queryKey: menuQueryKey(restaurantId),
    queryFn: async () => {
      const res = await api.get(`/menu/${restaurantId}`);
      return res.data as Menu[];
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!restaurantId,
    select: (data) => data ?? [],
  });
}

export function useMenuById(menuId: string) {
  return useQuery<Menu>({
    queryKey: ['menu', menuId],
    queryFn: async () => {
      const res = await api.get<Menu>(`menu/find/${menuId}`);
      return res.data;
    },
    enabled: !!menuId,
  });
}

export function useCreateMenu(restaurantId: string) {
  const queryClient = useQueryClient();
  const queryKey = menuQueryKey(restaurantId);

  return useMutation({
    mutationFn: async ({ formData }: CreateMenuPayload) => {
      const res = await api.post<Menu>("/menu/single", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return res.data;
    },
    onMutate: async ({ optimistic }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Menu[]>(queryKey);
      queryClient.setQueryData<Menu[]>(queryKey, (old) => [
        { ...optimistic, menuId: `temp-${Date.now()}` },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      queryClient.setQueryData(queryKey, ctx?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUpdateMenu(restaurantId: string) {
  const queryClient = useQueryClient();
  const queryKey = menuQueryKey(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, formData }: UpdateMenuPayload) => {
      const res = await api.patch(`/menu/single/${menuId}`, formData, {
        headers: { 'Content-Type': "multipart/form-data" },
      });
      return res.data as Menu;
    },
    onMutate: async ({ menuId, optimistic }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Menu[]>(queryKey);
      queryClient.setQueryData<Menu[]>(queryKey, (old) =>
        old?.map((m) => (m.menuId === menuId ? { ...m, ...optimistic } : m)) ?? []
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

export function useToggleMenuAvailability(restaurantId: string) {
  const queryClient = useQueryClient();
  const queryKey = menuQueryKey(restaurantId);

  return useMutation({
    mutationFn: async ({ menuId, isAvailable }: { menuId: string; isAvailable: boolean }) => {
      const res = await api.patch(`menu/is-available/${menuId}`, { restaurantId, isAvailable });
      return res.data as Pick<Menu, 'menuId' | 'isAvailable'>;
    },
    onMutate: async ({ menuId, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Menu[]>(queryKey);
      queryClient.setQueryData<Menu[]>(queryKey, (old) =>
        old?.map((m) => (m.menuId === menuId ? { ...m, isAvailable } : m)) ?? []
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

export function useDeleteMenu(restaurantId: string) {
  const queryClient = useQueryClient();
  const queryKey = menuQueryKey(restaurantId);

  return useMutation({
    mutationFn: async (menuId: string) => {
      await api.delete(`/menu/${menuId}`);
    },
    onMutate: async (menuId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Menu[]>(queryKey);
      queryClient.setQueryData<Menu[]>(queryKey, (old) =>
        old?.filter((m) => m.menuId !== menuId) ?? []
      );
      return { previous };
    },
    onError: (_err, _menuId, ctx) => {
      queryClient.setQueryData(queryKey, ctx?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}