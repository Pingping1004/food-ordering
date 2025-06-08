import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import React from "react";
import { UseFormRegister, FieldValues, Path } from "react-hook-form";

const inputVariants = cva(
  "flex items-center w-full px-0 py-2 mb-5 text-lg outline-none border-b-2 placeholder:text-gray-400",
  {
    variants: {
      variant: {
        primary: "border-[text-lighter] text-gray-900",
        error: "border-danger-main text-red-900",
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
    type?: "text" | "email" | "password" | "select";
    onChange?: (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => void;
    options?: { key: string; value: string }[];
    error?: string;
    className?: string;
    value?: string;
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

  return (
    <div className="flex flex-col w-full mb-4">
      {label && (
        <label
          htmlFor={typeof name === "string" ? name : ""}
          className="mb-2 text-sm text-start noto-sans-regular text-secondary"
        >
          {label}
        </label>
      )}

      {type === "select" ? (
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
            className
          )}
        />
      )}

      {error && <span className="mt-1 text-xs text-danger-main">{error}</span>}
    </div>
  );
};
