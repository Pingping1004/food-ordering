// components/ui/multi-date-picker.tsx
"use client";

import React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils"; // This is a utility function from your Shadcn setup
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface MultiDatePickerProps {
    readonly value: Date[] | undefined;
    readonly onDatesChange: (dates: Date[] | undefined) => void;
}

export function MultiDatePicker({ value, onDatesChange }: MultiDatePickerProps) {
    const shortEngDays = [
        { label: 'Sun', value: 'sun' },
        { label: 'Mon', value: 'mon' },
        { label: 'Tue', value: 'tue' },
        { label: 'Wed', value: 'wed' },
        { label: 'Thu', value: 'thu' },
        { label: 'Fri', value: 'fri' },
        { label: 'Sat', value: 'sat' },
    ];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value || value.length === 0 ? "text-muted-foreground" : ""
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value && value.length > 0 ? (
                        value.map((date: Date) => {
                            const dayIndex = date.getDay();
                            const dayLabel = shortEngDays[dayIndex]?.label || 'Unknown';
                            return <span key={dayLabel}>{dayLabel}</span>;
                        })
                    ) : (
                        <span>เลือกวัน</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="multiple"
                    selected={value}
                    onSelect={onDatesChange}
                // disabled={(date) => date.getDay() === 0 || date.getDay() === 6}
                />
            </PopoverContent>
        </Popover>
    );
}