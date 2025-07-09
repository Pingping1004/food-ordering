"use client";

import React, { useState, useEffect } from "react";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";

interface TimePickerInputProps {
  value: string; // The time value in "HH:mm" format (or whatever you need)
  onChange: (value: string) => void;
  onBlur: () => void; // Provided by Controller for blur events
  name: string;
}

const TimePickerInput: React.FC<TimePickerInputProps> = ({
  value,
  onChange,
  onBlur,
  name,
}) => {
   const [internalTime24hr, setInternalTime24hr] = useState(value || '');

  // useEffect to keep internal state in sync with the 'value' prop from Controller.
  // This is crucial for controlled components with react-hook-form.
  useEffect(() => {
    setInternalTime24hr(value || '');
  }, [value]); // Re-run whenever the 'value' prop changes

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value; // This is directly "HH:mm" from the input
    setInternalTime24hr(newValue); // Update internal state for immediate display
    onChange(newValue); // **Crucially: Call the onChange from Controller with the "HH:mm" string**
  };

  return (
    <div>
      <input
        type="time"
        name={name} // Pass the name from Controller
        value={internalTime24hr}
        onChange={handleChange}
        onBlur={onBlur}
        className="border p-2 rounded w-full"
      />
      {/* You can still have your display logic */}
      <p className="text-sm text-gray-500 mt-2">
        {/* AM: ก่อนเที่ยง / PM: หลังเที่ยง */}
      </p>
    </div>
  );
}

export default TimePickerInput;