import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
    return (
        <RadioGroupPrimitive
            data-slot="radio-group"
            className={cn("ui-radio-group", className)}
            {...props}
        />
    );
}

function RadioGroupItem({
    className,
    children,
    ...props
}: RadioPrimitive.Root.Props) {
    return (
        <RadioPrimitive.Root
            data-slot="radio-group-item"
            className={cn("ui-radio", className)}
            {...props}
        >
            {children ?? (
                <RadioPrimitive.Indicator
                    data-slot="radio-group-indicator"
                    className="flex size-4 items-center justify-center"
                >
                    <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
                </RadioPrimitive.Indicator>
            )}
        </RadioPrimitive.Root>
    );
}

export { RadioGroup, RadioGroupItem };
