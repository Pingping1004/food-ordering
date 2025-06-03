import React from "react";
import { Button } from "../Button";

export default function CookerHeader() {
    return (
        <>
            <header className="w-full flex items-center">
                <div className="grid grid-cols-2 w-full">
                    <div>
                        <h1 className="font-bold items-center">SomChai Suchi</h1>
                    </div>

                    <div className="w-full flex justify-between items-center">
                        <Button
                            variant="primary"
                            size="md"
                        >จัดการเมนู</Button>

                        <div>
                            <div className="profile-icon">profile</div>
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
}
