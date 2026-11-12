import type { ButtonHTMLAttributes } from "react";
import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    intent?: "primary" | "secondary" | "ghost" | null;
    size?: "default" | "small" | null;
    fullWidth?: boolean | null;
};

export function Button({
    intent,
    size,
    fullWidth,
    className,
    ...props
}: ButtonProps) {
    return (
        <ShadcnButton
            variant={intent === "primary" || !intent ? "default" : intent}
            size={size === "small" ? "sm" : "default"}
            className={cn(fullWidth && "w-full", className)}
            {...props}
        />
    );
}
