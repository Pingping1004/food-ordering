"use client";

import { useState, useCallback, useMemo } from 'react'
import { Menu as MenuComponent } from '@/components/cookers/Menu'
import { useParams, useRouter } from 'next/navigation';
import { useDeleteMenu, useToggleMenuAvailability, useMenus, useUpdateMenu } from '@/hook/useMenu';
import { toastError, toastSuccess } from '@/components/ui/Toast';
import { compressImage } from '@/lib/compressImage';
import { hasMenuPhoto } from '@/lib/types/menu';
import { useCooker } from '@/hook/useCooker';
import { useAuth } from '@/auth/auth.hooks';
import { isSystemAdmin, restaurantRole } from '@/auth/access';
import { CookerShell } from '@/components/cookers/CookerShell';

function Page() {
    const params = useParams();
    const restaurantId = params.restaurantId as string;
    const { data: cooker } = useCooker(restaurantId);
    const [searchQuery, setSearchQuery] = useState("");
    const router = useRouter();

    const { data: menus = [] } = useMenus(restaurantId);
    const { mutate: toggleAvailability } = useToggleMenuAvailability(restaurantId);
    const { mutate: deleteMenu } = useDeleteMenu(restaurantId);
    const { user } = useAuth();
    const canDelete = ['OWNER', 'ADMIN'].includes(restaurantRole(user, restaurantId) ?? '') || isSystemAdmin(user);
    const { mutate: updateMenu } = useUpdateMenu(restaurantId);
    const missingPhotoCount = useMemo(() => menus.filter((m) => !hasMenuPhoto(m.menuImg)).length, [menus]);

    const filteredMenus = useMemo(() => {
        if (!menus) return [];

        const query = searchQuery.trim().toLowerCase();

        return menus.filter(menu => {
            if (!query) return true;
            return menu.name.toLowerCase().includes(query);
        });
    }, [menus, searchQuery]);

    const handleMenuAvailabilityChange = useCallback(
        (menuId: string, newIsAvailable: boolean) => {
            toggleAvailability(
                { menuId, isAvailable: newIsAvailable },
                { onError: (err) => toastError("เปลี่ยนสถานะเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err) }
            );
        },
        [toggleAvailability]
    );

    const handleDeleteMenu = useCallback(
        (menuId: string) => {
            deleteMenu(menuId, {
                onError: (err) => toastError("ลบเมนูไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", err),
            });
        },
        [deleteMenu]
    );

    const handlePhotoSelected = useCallback(
        async (menuId: string, file: File) => {
            try {
                const small = await compressImage(file).catch(() => file);
                const formData = new FormData();
                formData.append('restaurantId', restaurantId);
                formData.append('menuImg', small);
                updateMenu(
                    { menuId, formData, optimistic: {} },
                    {
                        onSuccess: () => toastSuccess('เพิ่มรูปเมนูแล้ว'),
                        onError: (err) => toastError('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', err),
                    }
                );
            } catch (err) {
                toastError('เลือกรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', err);
            }
        },
        [restaurantId, updateMenu]
    );

    if (!cooker) return null;

    return (
        <CookerShell restaurantId={cooker.restaurantId} active="menu">
            <header className="flex flex-col gap-3.5 border-b border-line-soft bg-white p-5">
                <h1 className="text-[28px] font-bold">เมนูของร้าน</h1>
                <div className="flex gap-2.5">
                    <button
                        type="button"
                        onClick={() => router.push(`/cooker/restaurant/add-menu/${cooker.restaurantId}`)}
                        className="flex h-[60px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-main text-xl font-bold text-white hover:bg-primary-dark"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>เพิ่มเมนู
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push(`/cooker/restaurant/add-menu-bulk/${cooker.restaurantId}`)}
                        className="flex h-[60px] items-center justify-center rounded-2xl border-[1.5px] border-line bg-white px-4 text-[17px] font-semibold"
                    >
                        เพิ่มหลายเมนู
                    </button>
                </div>
                <label className="flex h-14 items-center gap-2.5 rounded-[14px] bg-ground px-4 text-brand-muted">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                    <input
                        type="search"
                        aria-label="ค้นหาเมนู"
                        placeholder="ค้นหาเมนู"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 bg-transparent text-lg text-brand-dark outline-none"
                    />
                </label>
            </header>

            <main className="flex flex-col gap-3 px-5 py-4">
                <p className="text-[17px] text-brand-muted">แตะสวิตช์เพื่อเปิด/ปิดขาย กด “แก้ไขเมนู” เพื่อแก้ไขรายละเอียด</p>
                {missingPhotoCount > 0 && (
                    <p className="rounded-2xl bg-primary-light px-4 py-3 text-[17px] text-primary-dark">
                        {missingPhotoCount} เมนูยังไม่มีรูป แตะช่อง “เพิ่มรูป” ที่เมนูนั้นเพื่ออัปโหลด (ลูกค้ายังสั่งได้ตามปกติ)
                    </p>
                )}
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMenus?.map((menu) => (
                        <MenuComponent
                            restaurantid={cooker.restaurantId}
                            key={menu.menuId}
                            menuId={menu.menuId}
                            menuImg={menu.menuImg}
                            name={menu.name}
                            price={menu.price}
                            isAvailable={menu.isAvailable ?? false}
                            onAvailabilityChanged={handleMenuAvailabilityChange}
                            onDelete={canDelete ? handleDeleteMenu : undefined}
                            onPhotoSelected={handlePhotoSelected}
                        />
                    ))}
                </ul>
                {filteredMenus.length === 0 && (
                    <p className="py-8 text-center text-lg text-brand-muted">ไม่พบเมนูที่ค้นหา</p>
                )}
            </main>
        </CookerShell>
    )
}

export default function ManageMenuPage() {
    return (
        <Page />
    )
}
