import type { ComponentProps } from "react";

export function ButtonGroup({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            role="group"
            className={`ui-button-group ${className ?? ""}`}
            {...props}
        />
    );
}
