import clsx from "clsx";
import { cva, VariantProps } from "class-variance-authority";
import { forwardRef, Ref, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { UseFormRegister, FieldValues, Path } from "react-hook-form";
import { UploadIcon } from "./ui/UploadIcon";

interface Option {
    key: string;
    value: string;
}

const inputVariants = cva(
    "flex items-center w-full h-[54px] px-4 text-[17px] font-app bg-white rounded-[14px] outline-none border-[1.5px] placeholder:text-brand-muted/70 focus:border-primary-main focus:ring-2 focus:ring-primary-main/20",
    {
        variants: {
            variant: {
                primary: "border-line text-brand-dark",
                error: "border-danger-main border-2 text-brand-dark",
                success: "border-success-main text-brand-dark",
            },
        },
        defaultVariants: {
            variant: "primary",
        },
    }
);

export type BaseInputProps<TFieldValues extends FieldValues = FieldValues> = Omit<
    React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement>,
    "name" | "value" | "onChange" | "onBlur" | "type" | "options" | "accept" | "tel"
> &
    VariantProps<typeof inputVariants> & {
        label?: string;
        name: Path<TFieldValues> | string;
        placeholder?: string;
        register?: UseFormRegister<TFieldValues>;
        validation?: object;
        type?: "text" | "email" | "password" | "select" | "file" | "number" | "tel"; // Added "file" type
        onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
        options?: { key: string; value: string }[];
        error?: string;
        className?: string;
        value?: string | number;
        accept?: string; // For file input, specify accepted file types
        onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLSelectElement>;
        ref?: React.Ref<HTMLInputElement | HTMLSelectElement>;
    };

export type InputProps<TFieldValues extends FieldValues = FieldValues> =
    // For type="select" inputs
    | (BaseInputProps<TFieldValues> & {
        type: "select"; // Discriminator
        options: Option[]; // Required for select type
    } & SelectHTMLAttributes<HTMLSelectElement>) // Include standard <select> attributes
    // For type="file" inputs
    | (BaseInputProps<TFieldValues> & {
        type: "file"; // Discriminator
        accept?: string; // 'accept' attribute specific to file inputs
    } & InputHTMLAttributes<HTMLInputElement>) // Include standard <input type="file"> attributes
    // For all other <input> types (e.g., text, number, email, password)
    | (BaseInputProps<TFieldValues> & {
        type?: Exclude<InputHTMLAttributes<HTMLInputElement>['type'], "select" | "file">; // Type can be text, number, etc.
    } & InputHTMLAttributes<HTMLInputElement>);

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
        const inputVariant = error ? "error" : (variant || 'primary');
        const labelColorClass =
            inputVariant === "error"
                ? "text-danger-main"
                : inputVariant === "success"
                    ? "text-success-main"
                    : "text-brand-dark";

        if (type === "select") {
            return (
                <div className="flex flex-col w-full">
                    {label && <label htmlFor={name}
                        className={clsx("mb-2 text-[15px] font-semibold text-start font-app", labelColorClass)}>{label}</label>}
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
                        {options.map((option) => {
                            if (option.value.startsWith("divider")) {
                                return (
                                    <option key={option.value} disabled>
                                        {option.key}
                                    </option>
                                );
                            }

                            return (
                                <option key={option.value} value={option.value}>
                                    {option.key}
                                </option>
                            );
                        })}
                    </select>
                    {error && <span className="mt-1.5 text-sm font-medium text-danger-main" role="alert">{error}</span>}
                </div>
            );
        }

        if (type === "file") {
            // You can still use a ref for the file input if needed, but it's separate from react-hook-form's ref
            return (
                <div className="flex flex-col w-full">
                    {label && <label htmlFor={name}
                        className={clsx("mb-2 text-[15px] font-semibold text-start font-app", labelColorClass)}>{label}</label>}
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
                        className="flex items-center justify-center gap-2 cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-line min-h-14 py-4 px-6 bg-white hover:bg-ground transition"
                    >
                        <UploadIcon className="w-6 h-6 text-gray-500" />
                        <span className="text-gray-700">{placeholder}</span>
                    </label>
                    {/* You can add a custom styled label here */}
                    {error && <span className="mt-1.5 text-sm font-medium text-danger-main" role="alert">{error}</span>}
                </div>
            );
        }

        return (
            <div className="flex flex-col w-full">
                {label && <label htmlFor={name}
                    className={clsx("mb-2 text-[15px] font-semibold text-start font-app", labelColorClass)}>{label}</label>}
                <input
                    id={name}
                    name={name}
                    type={type}
                    placeholder={placeholder}
                    ref={ref as Ref<HTMLInputElement>} // Pass ref to the native element
                    className={clsx(inputVariants({ variant: inputVariant }), className)}
                    {...props} // Spread all props from react-hook-form
                />
                {error && <span className="mt-1.5 text-sm font-medium text-danger-main" role="alert">{error}</span>}
            </div>
        );
    }
);

Input.displayName = "Input";
export default Input
