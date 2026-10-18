import { redirect } from "next/navigation";

/** Hours are edited in a modal on the settings page now; keep old links working. */
export default async function CookerHoursRedirect({ params }: Readonly<{ params: Promise<{ restaurantId: string }> }>) {
    const { restaurantId } = await params;
    redirect(`/cooker/profile/${restaurantId}`);
}
