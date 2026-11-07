import { useState } from "react";
import { avatarNumber, avatarSource } from "../avatars";
import "../avatars.css";

export function Avatar({
    value,
    decorative = false,
}: {
    value: string;
    decorative?: boolean;
}) {
    const source = avatarSource(value);
    const [failedSource, setFailedSource] = useState("");
    const label = `Memoji avatar ${avatarNumber(value)}`;

    if (failedSource === source) {
        return (
            <span
                className="memoji-fallback"
                role={decorative ? undefined : "img"}
                aria-label={decorative ? undefined : label}
                aria-hidden={decorative || undefined}
            >
                ?
            </span>
        );
    }

    return (
        <img
            className="memoji-avatar"
            src={source}
            alt={decorative ? "" : label}
            width={256}
            height={256}
            decoding="async"
            draggable={false}
            onError={() => setFailedSource(source)}
        />
    );
}
