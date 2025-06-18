"use client";

import React, { useState } from "react";
import TimePicker from "react-time-picker";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";

export function TimePickerInput() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5); // "HH:mm"
  });

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="time" className="text-sm noto-sans-regular text-secondary">
        เลือกเวลารับออเดอร์ AM (ก่อนเที่ยง) / PM (หลังเที่ยง)
      </label>
      <input 
        type="time" 
        id="time"
        value={time}
        onChange={(event) => setTime(event.target.value)}
        step="60"
        className=""
      />
    </div>
  );
}

