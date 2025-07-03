"use client";

import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import React, { forwardRef, Ref, useRef } from "react";
import { UseFormRegister, FieldValues, Path } from "react-hook-form";
import { UploadIcon } from "./ui/UploadIcon";

const inputVariants = cva(
  "flex items-center w-full px-0 py-2 text-lg noto-sans-regular outline-none border-b-2 placeholder:text-gray-400",
  {
    variants: {
      variant: {
        primary: "border-color text-gray-900",
        error: "border-danger-main text-danger-main",
        success: "border-success-main text-green-900",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

export type InputProps<TFieldValues extends FieldValues = FieldValues> = Omit<
  React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement>,
  "name" | "value" | "onChange" | "onBlur"
> &
  VariantProps<typeof inputVariants> & {
    label?: string;
    name: Path<TFieldValues> | string;
    placeholder?: string;
    register?: UseFormRegister<TFieldValues>;
    validation?: object;
    type?: "text" | "email" | "password" | "select" | "file" | "number"; // Added "file" type
    onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    options?: { key: string; value: string }[];
    error?: string;
    className?: string;
    value?: string | number;
    accept?: string; // For file input, specify accepted file types
    onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement>;
    ref?: React.Ref<HTMLInputElement | HTMLSelectElement>;
  };

export const Input = forwardRef<HTMLInputElement | HTMLSelectElement, InputProps>(
  (
    {
      label,
      name,
      placeholder,
      type = "text",
      options = [],
      error,
      variant,
      className,
      ...props // All props, including value, onChange, onBlur, etc., are in here
    },
    ref // This is the ref from react-hook-form
  ) => {
    // Determine the variant based on the error state
    const inputVariant = error ? "error" : variant;

    if (type === "select") {
      return (
        <div className="flex flex-col w-full">
          {label && <label htmlFor={name}
            className="mb-2 text-sm text-start noto-sans-regular text-secondary">{label}</label>}
          <select
            id={name}
            name={name}
            ref={ref as Ref<HTMLSelectElement>} // Pass ref to the native element
            className={clsx(inputVariants({ variant: inputVariant }), className)}
            {...props} // Spread all props from react-hook-form
          >
            <option value="" disabled hidden>
              {placeholder || "Select an option"}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.key}
              </option>
            ))}
          </select>
          {error && <span className="text-sm text-danger-main">{error}</span>}
        </div>
      );
    }

    if (type === "file") {
      // You can still use a ref for the file input if needed, but it's separate from react-hook-form's ref
      return (
        <div className="flex flex-col w-full">
          {label && <label htmlFor={name}
            className="mb-2 text-sm text-start noto-sans-regular text-secondary">{label}</label>}
          <input
            id={name}
            type="file"
            name={name}
            // onChange={onChange}
            ref={ref as Ref<HTMLInputElement>} // Pass ref to the file input
            className={clsx("hidden", className)}
            {...props} // Spread all props from react-hook-form
          />
          <label
            htmlFor={name}
            className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-400 py-4 px-6 bg-gray-50 hover:bg-gray-100 transition"
          >
            <UploadIcon className="w-6 h-6 text-gray-500" />
            <span className="text-gray-700">อัปโหลดรูปภาพเมนู</span>
          </label>
          {/* You can add a custom styled label here */}
          {error && <span className="text-sm text-danger-main">{error}</span>}
        </div>
      );
    }

    return (
      <div className="flex flex-col w-full">
        {label && <label htmlFor={name}
          className="mb-2 text-sm text-start noto-sans-regular text-secondary">{label}</label>}
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          ref={ref as Ref<HTMLInputElement>} // Pass ref to the native element
          className={clsx(inputVariants({ variant: inputVariant }), className)}
          {...props} // Spread all props from react-hook-form
        />
        {error && <span className="text-sm text-danger-main">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input"; // This is a good practice for debugging
