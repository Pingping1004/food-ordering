import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function Toggle({
  className,
  label,
  ...props
}: React.ComponentProps<typeof Switch> & {
  label: string;
  onClick: () => boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-y-2">
      <Label className="text-[10px] text-primary noto-sans-regular">
        {label}
      </Label>
      <Switch id="order-available" {...props} />
    </div>
  );
}
