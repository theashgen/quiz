import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("ui-button", {
    variants: {
        variant: {
            default: "primary",
            outline: "button-outline",
            secondary: "button-outline",
            ghost: "text-button",
        },
        size: { default: "", sm: "ui-button-small" },
    },
    defaultVariants: { variant: "default", size: "default" },
});

function Button({
    className,
    variant,
    size,
    ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
    return (
        <ButtonPrimitive
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
