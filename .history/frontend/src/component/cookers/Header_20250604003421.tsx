import React from "react";

export default function CookerHeader() {
  return (
    <>
      <header className="w-full flex justify-between items-center p-4 ">
        <div>
          <h1>SomChai Suchi</h1>
        </div>

        <div>
          <button>จัดการเมนู</button>

          <div>
            <div className="profile-icon">👤</div>
          </div>
        </div>
      </header>
    </>
  );
}
