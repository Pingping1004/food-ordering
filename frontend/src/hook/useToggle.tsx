"use client";

import { useState } from "react";

export function useToggle<T extends { value: string }>(
    items: T[],
    maxSelected: number = 3
) {
    const [variants, setVariants] = useState<Array<'primary' | 'tertiary'>>(items.map(() => 'tertiary'));
    const [selected, setSelected] = useState<T[]>([]);

    const toggle = (index: number) => {
        setVariants((prev) => {
            const selectedCount = prev.filter((item) => item === 'primary').length;
            const isSelected = prev[index] === 'primary';

            if (!isSelected && selectedCount >= maxSelected) {
                alert(`สามารถเลือกได้สูงสุด ${maxSelected}รายการเท่านั้น`)
                return prev;
            }

            return prev.map((state, i) => (
                i === index ? (state === 'primary' ? 'tertiary' : 'primary') : state
            ));
        })

        setSelected((prev) => {
            const value = items[index].value;
            const isSelected = variants[index] === 'primary';

            if (isSelected) {
                return prev.filter((item) => item.value !== value);
            } else {
                if (prev.length >= maxSelected) return prev;
                return [...prev,  items[index]];
            }
        });
    };

    return { variants, selected, toggle }
}