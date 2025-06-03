import React from 'react';

export const NumberIssued = ({ issuedOrder }: { issuedOrder: number }) => {
    return (
        <div className="">
            {issuedOrder > 0 ? issuedOrder : 0};
        </div>
    )
}