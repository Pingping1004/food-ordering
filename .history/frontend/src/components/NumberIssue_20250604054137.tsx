import React from 'react';

type NumberIssuedProps = {
    number: number;
    size?: 'md' | 'lg';
}
export const NumberIssued = ({ issuedOrder, size = 'md' }: { issuedOrder: number }) => {
    return (
        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-primary text-xs noto-sans-bold">
            {issuedOrder > 0 ? issuedOrder : 0}
        </div>
    )
}