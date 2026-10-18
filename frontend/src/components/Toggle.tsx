interface ToggleProps {
  checked: boolean;
  onCheckedChange: (newChecked: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
  onText?: string;
  offText?: string;
  className?: string;
}

export function Toggle({
    checked,
    onCheckedChange,
    disabled,
    label,
    id,
    onText = "เปิด",
    offText = "ปิด",
    className = "",
}: ToggleProps) {
    return (
        <button
            type="button"
            id={id}
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={`flex h-14 w-[88px] shrink-0 flex-col justify-center rounded-full p-1 transition-colors disabled:opacity-60 ${checked ? "items-end bg-success-main" : "items-start bg-[#98A2B3]"} ${className}`}
        >
            <span className={`flex h-12 items-center rounded-full bg-white px-3 text-[15px] font-bold shadow-[0_1px_3px_rgba(0,0,0,0.2)] ${checked ? "text-success-main" : "text-[#475467]"}`}>
                {checked ? onText : offText}
            </span>
        </button>
    );
}
