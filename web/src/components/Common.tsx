import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";
import type { Setup, Catalog } from "../types";
import { AvatarPicker } from "./AvatarPicker";

export function ErrorMessage({ children }: { children: ReactNode }) {
    return (
        <div
            className="error mx-0 my-[15px] rounded-[9px] border border-solid border-[#e6bca9] bg-[#fae9df] px-[15px] py-3 text-[12px] leading-[1.6] text-[#8b3e26]"
            role="alert"
        >
            {children}
        </div>
    );
}

export function Identity({
    setup,
    onChange,
    catalog,
    autoFocusName = false,
}: {
    setup: Setup;
    onChange: (s: Setup) => void;
    catalog: Catalog;
    autoFocusName?: boolean;
}) {
    return (
        <div className="identity">
            <Label>
                Your name
                <Input
                    variant="themed"
                    required
                    maxLength={30}
                    value={setup.name}
                    onChange={(e) =>
                        onChange({ ...setup, name: e.target.value })
                    }
                    placeholder="What should we call you?"
                    autoComplete="nickname"
                    autoFocus={autoFocusName}
                />
            </Label>
            <AvatarPicker
                avatars={catalog.avatars}
                value={setup.avatar}
                onChange={(avatar) => onChange({ ...setup, avatar })}
            />
        </div>
    );
}
