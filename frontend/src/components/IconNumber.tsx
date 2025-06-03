import React from "react";

type IconNumberProps = {
  numberIcon: number;
  size?: "md" | "lg" | "full" | "half";
  className?: string;
};
export const IconNumber = ({numberIcon, size = 'md', className = ''}: IconNumberProps) => {
    const sizeClasses = size === 'lg' ? 'w-5 h-5 text-sm' : 'w-4 h-4 text-xs';
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white text-primary noto-sans-bold ${sizeClasses} ${className}`}
    >
      {numberIcon > 0 ? numberIcon : 0}
    </div>
  );
};
