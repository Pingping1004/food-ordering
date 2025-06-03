import React from "react";

type NumberIssuedProps = {
  issuedOrder: number;
  size?: "md" | "lg";
};
export const NumberIssued = ({issuedOrder, size}: NumberIssuedProps) => {
    let sizeClasses = '';

  switch (size) {
    case 'lg':
      sizeClasses = 'w-5 h-5 text-sm'; // 20x20
      break;
    case 'full':
    case 'half':
    case 'md':
    default:
      sizeClasses = 'w-4 h-4 text-xs'; // 16x16 or fallback
      break;
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white text-primary text-xs noto-sans-bold ${sizeClasses}`}
    >
      {issuedOrder > 0 ? issuedOrder : 0}
    </div>
  );
};
