"use client";

import { useCallback, useState } from 'react'
import { Toggle } from '@/components/Toggle';
import { useParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { useAuth } from '@/auth/auth.hooks';
import CookerHeader from '@/components/cookers/CookerHeader';
import { useCooker, useToggleRestaurantClosed } from '@/hook/useCooker';

function Page() {
    const params = useParams();
    const restaurantId = (params.restaurantId) as string;
    const { data: cooker } = useCooker(restaurantId);
    const { mutate: toggleClosed, isPending: isPatching } = useToggleRestaurantClosed(restaurantId)
    const { logout } = useAuth();
    const [error,] = useState(null);

    const toggleCheckedState = cooker?.isTemporarilyClosed;
    const handleRestaurantAvailabilityChange = useCallback(
        (newIsTemporarilyClosed: boolean) => {
          toggleClosed(newIsTemporarilyClosed);
        },
        [toggleClosed]
      );

    if (!cooker) return <div>Loading restaurant profile...</div>
    if (error) return <div>Error</div>

    return (
        <div className="flex flex-col gap-y-10 py-10 px-6">
            <CookerHeader
                restaurantId={cooker.restaurantId}
                name={cooker.name}
                openTime={cooker.openTime}
                closeTime={cooker.closeTime}
            />
            <div className="flex items-center justify-center gap-x-2">
                <p className="font-noto-thai text-primary ">ปิดร้านชั่วคราว</p>
                <Toggle
                    id={restaurantId}
                    checked={toggleCheckedState || false}
                    disabled={isPatching}
                    label=""
                    onCheckedChange={handleRestaurantAvailabilityChange}
                />
            </div>
            <Button
                type="button"
                variant="secondaryDanger"
                size="full"
                onClick={() => logout()}
            >
        Logout
            </Button>
        </div>
    )
}

export default function RestaurantProfilePage() {
    return (
        <Page />
    )
}
