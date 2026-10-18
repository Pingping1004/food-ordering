import { CookerGate } from "@/components/cookers/CookerGate";

export default function CookerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <CookerGate>{children}</CookerGate>;
}
