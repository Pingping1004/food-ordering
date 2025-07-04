import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (newChecked: boolean) => void;
  disabled?: boolean;
  label: string;
  className?: string;
  id?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
  id,
  ...props
}: ToggleProps & Omit<React.ComponentPropsWithoutRef<typeof Switch>, 'checked' | 'onCheckedChange' | 'disabled'>) {
  // `Omit` is used to prevent prop collisions if `Switch` also had a 'label' prop for example.
  // `React.ComponentPropsWithoutRef<typeof Switch>` includes all native props for the underlying element.

  return (
    <div className={`flex flex-col items-start gap-y-2 ${className}`}>
      <Label className="text-[10px] text-primary noto-sans-regular">
        {label}
      </Label>
      <Switch
        id="order-available"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        {...props}
      />
    </div>
  );
}