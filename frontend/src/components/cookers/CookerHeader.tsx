import { usePathname, useRouter } from "next/navigation";
import { Button } from "../Button";
import dynamic from "next/dynamic";

const Profile = dynamic(() => import("@/components/Profile"))

export interface Restaurant {
    restaurantId: string;
    name: string;
    location?: string;
    openTime: string;
    closeTime: string;
}

export default function CookerHeader({
    name,
    restaurantId,
}: Readonly<Restaurant>) {
    const pathname = usePathname();
    const router = useRouter();
    const isCookerHome = pathname === `/cooker/${restaurantId}`;
    const isCookerRoute = pathname.startsWith('/cooker/');

    return (
        <header className="w-full flex items-center">
            <div className="flex items-center w-full">
                <h1 className="w-2/5 font-noto-thai font-bold md:text-3xl text-2xl inline-block">{name}</h1>

                <div className="w-full flex justify-end items-center gap-x-6">
                    {isCookerHome && (
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() =>
                                router.push(`/cooker/restaurant/managed-menu/${restaurantId}`)
                            }
                        >
                            จัดการเมนู
                        </Button>
                    )}

                    {isCookerRoute && !isCookerHome && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => router.push(`/cooker/${restaurantId}`)}
                        >
                            <p className="text-sm">กลับหน้าหลัก</p>
                        </Button>

                    )}

                    <div>
                        <div className="flex items-center profile-icon">
                            {restaurantId ? (
                                <button
                                    onClick={() => router.push(`/cooker/profile/${restaurantId}`)}
                                >
                                    <Profile />
                                </button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="secondaryDanger"
                                    onClick={() => router.push(`/cooker/profile/${restaurantId}`)}
                                >
                                    ล็อกเอาท์
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
