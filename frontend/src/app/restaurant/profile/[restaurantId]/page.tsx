"use client";

import React, { useCallback, useState } from 'react'
import { Toggle } from '@/components/Toggle';
import { useParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/Authcontext';
import { CookerProvider, useCooker } from '@/context/Cookercontext';
import { getParamId } from '@/util/param';
import { api } from '@/lib/api';
import CookerHeader from '@/components/cookers/Header';

function Page() {
    const params = useParams();
    const restaurantId = getParamId(params.restaurantId);
    const { cooker, setCooker } = useCooker();
    const { logout } = useAuth();
    const [isPatching, setIsPatching] = useState(false);
    const [error,] = useState(null);

    const toggleCheckedState = cooker?.isTemporarilyClosed;
    const handleRestaurantAvailabilityChange = useCallback(async (newIsTemporarilyClosed: boolean) => {
        if (!cooker || !cooker.restaurantId) {
            console.error('Cooker data or restaurantId is missing');
            return;
        }

        const prevIsTemporarilyClosed = !!cooker.isTemporarilyClosed;
        setIsPatching(true);
        setCooker(prevCooker => {
            if (!prevCooker) return prevCooker;
            return { ...prevCooker, isTemporarilyClosed: newIsTemporarilyClosed };
        });

        try {
            const payload = {
                isTemporarilyClosed: newIsTemporarilyClosed,
            };

            const response = await api.patch(`restaurant/temporarily-close/${restaurantId}`, payload);

            const confirmedIsTemporarilyClosed = typeof response.data.isTemporarilyClosed === 'boolean'
                ? response.data.isTemporarilyClosed
                : newIsTemporarilyClosed;

            setCooker((prevData) => {
                if (!prevData) return;
                return { ...prevData, isTemporarilyClosed: confirmedIsTemporarilyClosed };
            });
        } catch (error) {
            console.error('Failed to update temporarily close status', error);
            setCooker(prevCooker => {
                if (!prevCooker) return prevCooker;
                return { ...prevCooker, isTemporarilyClosed: prevIsTemporarilyClosed };
            })
        } finally {
            setIsPatching(false);
        }
    }, [cooker, setCooker]);

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
                <p className="noto-sans-regular text-primary text-base">ปิดร้านชั่วคราว</p>
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
        <CookerProvider>
            <Page />
        </CookerProvider>
    )
}
