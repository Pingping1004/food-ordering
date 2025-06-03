import React from "react";

type NumberIssuedProps = {
  issuedOrder: number;
  size?: "md" | "lg" | "full" | "half";
};
export const NumberIssued = ({issuedOrder, size}: NumberIssuedProps) => {
    lconst sizeClasses = size === 'lg' ? 'w-5 h-5 text-sm' : 'w-4 h-4 text-xs';
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white text-primary text-xs noto-sans-bold ${sizeClasses}`}
    >
      {issuedOrder > 0 ? issuedOrder : 0}
    </div>
  );
};
