import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("", {
    variants: {
        variant: {
            default: "ui-button primary",
            outline: "ui-button button-outline",
            secondary: "ui-button button-outline",
            ghost: "ui-button text-button",
            unstyled: "",
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
