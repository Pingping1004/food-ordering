import React from "react";

export default function CookerHeader() {
  return (
    <>
      <header className="w-full flex justify-between items-center px-6">
        <div className="grid grid-cols-2 w-full">
          <div>
            <h1>SomChai Suchi</h1>
          </div>

          <div className="w- flex justify-around items-center">
            <button>จัดการเมนู</button>

            <div>
              <div className="profile-icon">profile</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
