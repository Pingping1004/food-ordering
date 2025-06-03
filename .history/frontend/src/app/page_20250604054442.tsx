import { Button } from "@/components/Button";
import CookerHeader from "@/components/cookers/Header";
import { NumberIssued } from "@/components/NumberIssue";

export default function CookerHomePage() {
  return (
    <div className="py-10 px-6">
      <CookerHeader />
      <section className="grid grid-cols-2 py-10 gap-4">
        <Button
          variant="danger"
          size="lg"
          className="flex items-center justify-between"
          icon={<NumberIssued issuedOrder={2} />}
        >
          ออเดอร์ที่มีปัญหา
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="flex items-center justify-between"
        >อัพเดทหลายออเดอร์</Button>
      </section>
    </div>
  );
}
