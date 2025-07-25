import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (newChecked: boolean) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}

export function Toggle({
    checked,
    onCheckedChange,
    disabled,
    label,
    className,
    ...props
}: ToggleProps & Omit<React.ComponentPropsWithoutRef<typeof Switch>, 'checked' | 'onCheckedChange' | 'disabled'>) {

    return (
        <div className={`flex flex-col items-start ${className}`}>
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