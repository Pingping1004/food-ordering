import { Button } from "@/components/Button";
import CookerHeader from "@/components/cookers/Header";

export default function CookerHomePage() {
    return (
        <div>
            <CookerHeader />
            <section className="grid grid-cols-2 px-6 py-10 gap-6">
                <Button variant="danger" size="md" >ออเดอร์ที่มีปัญหา</Button>
            </section>
        </div>
    );
}
