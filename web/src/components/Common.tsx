import type { ReactNode } from "react";
import type { Setup, Catalog } from "../types";
import { AvatarPicker } from "./AvatarPicker";

export function ErrorMessage({ children }: { children: ReactNode }) {
    return (
        <div className="error" role="alert">
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
            <label>
                Your name
                <input
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
            </label>
            <AvatarPicker
                avatars={catalog.avatars}
                value={setup.avatar}
                onChange={(avatar) => onChange({ ...setup, avatar })}
            />
        </div>
    );
}
