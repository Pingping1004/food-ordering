"use client";

import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import React, { useRef } from "react";
import { UseFormRegister, FieldValues, Path } from "react-hook-form";
import { UploadIcon } from "./ui/UploadIcon";

const inputVariants = cva(
  "flex items-center w-full px-0 py-2 text-lg noto-sans-regular outline-none border-b-2 placeholder:text-gray-400",
  {
    variants: {
      variant: {
        primary: "border-[text-lighter] text-gray-900",
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
  "name"
> &
  VariantProps<typeof inputVariants> & {
    label?: string;
    name: Path<TFieldValues> | string;
    placeholder?: string;
    register?: UseFormRegister<TFieldValues>;
    validation?: object;
    type?: "text" | "email" | "password" | "select" | "file" | "number"; // Added "file" type
    onChange?: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => void;
    options?: { key: string; value: string }[];
    error?: string;
    className?: string;
    value?: string;
    accept?: string; // For file input, specify accepted file types
  };

export const Input = <TFieldValues extends FieldValues = FieldValues>({
  label,
  name,
  register,
  validation,
  placeholder,
  type = "text",
  options = [],
  error,
  variant,
  className,
  value,
  onChange,
  ...props
}: InputProps<TFieldValues>) => {
  const commonProps =
    register && typeof name === "string"
      ? register(name as Path<TFieldValues>, validation)
      : {};

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col w-full">
      {label && (
        <label
          htmlFor={typeof name === "string" ? name : ""}
          className="mb-2 text-sm text-start noto-sans-regular text-secondary"
        >
          {label}
        </label>
      )}

      {type === "file" ? (
        <>
          <input
            id={typeof name === "string" ? name : ""}
            type="file"
            ref={fileInputRef}
            accept={props.accept || "image/*"}
            {...commonProps}
            {...props}
            onChange={onChange}
            className={clsx("hidden", className)}
          />

          <label
            htmlFor={typeof name === "string" ? name : ""}
            className={clsx(
              "flex md:w-full md:h-full h-40 w-40 cursor-pointer items-center justify-center bg-[#E1E1E1] rounded-2xl",
              variant === "error" ? "text-danger-light" : "text-primary",
              className
            )}
          >
            <UploadIcon className="h-8 w-8 text-white" />
          </label>
        </>
      ) : type === "select" ? (
        <select
          id={typeof name === "string" ? name : ""}
          {...commonProps}
          {...props}
          value={value}
          onChange={onChange}
          className={clsx(
            inputVariants({ variant: error ? "error" : "primary" }),
            className
          )}
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
      ) : (
        <input
          id={typeof name === "string" ? name : ""}
          {...commonProps}
          {...props}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={clsx(
            inputVariants({ variant: error ? "error" : variant }),
            (className = `${
              variant === error ? "text-danger-light" : "text-primary"
            }`)
          )}
        />
      )}

      {error && <span className="text-sm text-danger-main">{error}</span>}
    </div>
  );
};
