import React from 'react';

export const NumberIssued = ({ issuedOrder }: { issuedOrder: number }) => {
    return (
        <div className="flex items-center justify-center">
            {issuedOrder > 0 ? issuedOrder : 0};
        </div>
    )
}