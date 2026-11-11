import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const buttonStyles = cva("ui-button", {
    variants: {
        intent: {
            primary: "primary",
            secondary: "button-outline",
            ghost: "text-button",
        },
        size: { default: "", small: "ui-button-small" },
        fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: { intent: "primary", size: "default", fullWidth: false },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonStyles>;

export function Button({
    intent,
    size,
    fullWidth,
    className,
    ...props
}: ButtonProps) {
    return (
        <button
            className={buttonStyles({ intent, size, fullWidth, className })}
            {...props}
        />
    );
}
