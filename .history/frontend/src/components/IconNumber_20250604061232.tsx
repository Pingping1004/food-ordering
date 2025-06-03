import React from "react";

type IconNumberProps = {
  issuedOrder: number;
  size?: "md" | "lg" | "full" | "half";
  className?: string;
};
export const IconNumber = ({issuedOrder, size = 'md', className = ''}: IconNumberProps) => {
    const sizeClasses = size === 'lg' ? 'w-5 h-5 text-sm' : 'w-4 h-4 text-xs';
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white text-primary noto-sans-bold ${sizeClasses} ${className}`}
    >
      {issuedOrder > 0 ? issuedOrder : 0}
    </div>
  );
};
