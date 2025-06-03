import { Button } from "@/components/Button";
import CookerHeader from "@/components/cookers/Header";
import { NumberIssued } from "@/components/NumberIssue";

export default function CookerHomePage() {
  return (
    <div>
      <CookerHeader />
      <section className="grid grid-cols-2 px-6 py-10 gap-4">
        <Button
          variant="danger"
          size="md"
          className="flex items-center justify-between"
          icon={<NumberIssued issuedOrder={2} />}
        >
          ออเดอร์ที่มีปัญหา
        </Button>
        <Button
          variant="secondary"
        >อัพเดทหลายออเดอร์</Button>
      </section>
    </div>
  );
}
