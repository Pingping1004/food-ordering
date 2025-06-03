import React from 'react';

export const NumberIssued = ({ issuedOrder }: { issuedOrder: number }) => {
    return (
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-xl">
            {issuedOrder > 0 ? issuedOrder : 0};
        </div>
    )
}