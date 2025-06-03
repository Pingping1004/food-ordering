import React from "react";

type NumberIssuedProps = {
  issuedOrder: number;
  size?: "md" | "lg";
  isLarge?: boolean; // Add a prop to determine size dynamically
};

export const NumberIssued = ({ issuedOrder, size, isLarge }: NumberIssuedProps) => {
  const dynamicSize = isLarge ? "lg" : size || "md"; // Determine size dynamically
  const sizeClasses = dynamicSize === "lg" ? "w-5 h-5 text-sm" : "w-4 h-4 text-xs"; // Apply size classes

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-white text-primary noto-sans-bold ${sizeClasses}`}
    >
      {issuedOrder > 0 ? issuedOrder : 0}
    </div>
  );
};
