import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonGroupVariants = cva("ui-button-group", {
    variants: {
        orientation: {
            horizontal: "",
            vertical: "flex-col",
        },
    },
    defaultVariants: {
        orientation: "horizontal",
    },
});

function ButtonGroup({
    className,
    orientation,
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
    return (
        <div
            role="group"
            data-slot="button-group"
            data-orientation={orientation}
            className={cn(buttonGroupVariants({ orientation }), className)}
            {...props}
        />
    );
}

export { ButtonGroup, buttonGroupVariants };
