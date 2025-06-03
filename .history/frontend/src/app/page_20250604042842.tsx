import CookerHeader from "@/component/cookers/Header";

export default function CookerHomePage() {
    return (
        <div>
            <CookerHeader />
            <section className="grid grid-cols-2 px-6 gap-6 noto-sans-regular text-sm">
                <button className="bg-danger-main text-white px-">ออเดอร์ที่มีปัญหา</button>
                <button className="bg-primary-light text-primary-main">อัพเดทหลายออเดอร์</button>
            </section>
        </div>
    );
}
