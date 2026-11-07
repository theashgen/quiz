import { useId, useRef, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { avatarNumber } from "../avatars";
import { Avatar } from "./Avatar";

export function AvatarPicker({
    avatars,
    value,
    onChange,
    carousel = false,
}: {
    avatars: string[];
    value: string;
    onChange: (value: string) => void;
    carousel?: boolean;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    const swipeStart = useRef<{
        identifier: number;
        x: number;
        y: number;
    } | null>(null);
    const quickChoices = avatars.slice(0, 6);
    if (avatars.includes(value) && !quickChoices.includes(value))
        quickChoices[quickChoices.length - 1] = value;
    const selectedIndex = Math.max(0, avatars.indexOf(value));

    function cycle(direction: number) {
        if (avatars.length)
            onChange(
                avatars[
                    (selectedIndex + direction + avatars.length) %
                        avatars.length
                ],
            );
    }

    function startSwipe(event: TouchEvent<HTMLDivElement>) {
        const touch = event.touches[0];
        swipeStart.current =
            event.touches.length === 1
                ? {
                      identifier: touch.identifier,
                      x: touch.clientX,
                      y: touch.clientY,
                  }
                : null;
    }

    function finishSwipe(event: TouchEvent<HTMLDivElement>) {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || event.touches.length) return;
        const touch = Array.from(event.changedTouches).find(
            (entry) => entry.identifier === start.identifier,
        );
        if (!touch) return;
        const horizontal = touch.clientX - start.x;
        const vertical = touch.clientY - start.y;
        if (
            Math.abs(horizontal) >= 40 &&
            Math.abs(horizontal) > Math.abs(vertical) * 1.2
        )
            cycle(horizontal < 0 ? 1 : -1);
    }

    return (
        <fieldset
            className={
                carousel ? "avatar-picker avatar-carousel" : "avatar-picker"
            }
        >
            <legend>
                Pick your avatar{" "}
                <button
                    className="avatar-browse"
                    type="button"
                    onClick={() => dialog.current?.showModal()}
                >
                    Browse all <span aria-hidden="true">↗</span>
                </button>
            </legend>
            {carousel ? (
                <div className="avatar-carousel-stage">
                    <div className="avatar-carousel-orbit" aria-hidden="true" />
                    <span className="avatar-carousel-spark" aria-hidden="true">
                        ✦
                    </span>
                    <div
                        className="avatar-carousel-friend avatar-carousel-friend-left"
                        aria-hidden="true"
                    >
                        <Avatar value="memoji-21" decorative />
                    </div>
                    <button
                        type="button"
                        className="avatar-carousel-arrow"
                        aria-label="Previous avatar"
                        disabled={!avatars.length}
                        onClick={() => cycle(-1)}
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <path d="m15 5-7 7 7 7" />
                        </svg>
                    </button>
                    <div
                        className="avatar-carousel-face"
                        onTouchStart={startSwipe}
                        onTouchEnd={finishSwipe}
                        onTouchCancel={() => {
                            swipeStart.current = null;
                        }}
                    >
                        <Avatar key={value} value={value} decorative />
                    </div>
                    <button
                        type="button"
                        className="avatar-carousel-arrow"
                        aria-label="Next avatar"
                        disabled={!avatars.length}
                        onClick={() => cycle(1)}
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                        >
                            <path d="m9 5 7 7-7 7" />
                        </svg>
                    </button>
                    <div
                        className="avatar-carousel-friend avatar-carousel-friend-right"
                        aria-hidden="true"
                    >
                        <Avatar value="memoji-58" decorative />
                    </div>
                    <span
                        className="avatar-carousel-sticker"
                        aria-hidden="true"
                    >
                        You’re on the list.
                    </span>
                    <span
                        className="avatar-carousel-count"
                        role="status"
                        aria-live="polite"
                    >
                        Avatar {selectedIndex + 1} of {avatars.length}
                    </span>
                </div>
            ) : (
                <div className="avatars">
                    {quickChoices.map((avatar) => (
                        <button
                            key={avatar}
                            type="button"
                            aria-label={`Avatar ${avatarNumber(avatar)}`}
                            aria-pressed={
                                avatarNumber(avatar) === avatarNumber(value)
                            }
                            className={
                                avatarNumber(avatar) === avatarNumber(value)
                                    ? "selected"
                                    : ""
                            }
                            onClick={() => onChange(avatar)}
                        >
                            <Avatar value={avatar} decorative />
                        </button>
                    ))}
                </div>
            )}
            {carousel && (
                <p className="avatar-carousel-swipe-hint">
                    Swipe left or right to find your face
                </p>
            )}
            {createPortal(
                <dialog
                    ref={dialog}
                    className="avatar-dialog"
                    aria-labelledby={headingId}
                >
                    <div className="avatar-dialog-heading">
                        <div>
                            <div className="eyebrow">A FACE FOR THE GAME</div>
                            <h2 id={headingId}>Find your quiz face.</h2>
                        </div>
                        <button
                            type="button"
                            className="avatar-dialog-close"
                            aria-label="Close avatar picker"
                            onClick={() => dialog.current?.close()}
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                aria-hidden="true"
                            >
                                <path d="m6 6 12 12M18 6 6 18" />
                            </svg>
                        </button>
                    </div>
                    <p className="avatar-dialog-description">
                        {avatars.length} faces. Pick the one that feels like
                        you.
                    </p>
                    <div
                        className="avatar-library"
                        role="group"
                        aria-label="Available Memoji avatars"
                    >
                        {avatars.map((avatar) => (
                            <button
                                key={avatar}
                                type="button"
                                aria-label={`Avatar ${avatarNumber(avatar)}`}
                                aria-pressed={
                                    avatarNumber(avatar) === avatarNumber(value)
                                }
                                className={
                                    avatarNumber(avatar) === avatarNumber(value)
                                        ? "selected"
                                        : ""
                                }
                                onClick={() => {
                                    onChange(avatar);
                                    dialog.current?.close();
                                }}
                            >
                                <Avatar value={avatar} decorative />
                                <span aria-hidden="true">
                                    {String(avatarNumber(avatar)).padStart(
                                        2,
                                        "0",
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="avatar-dialog-credit">
                        Memojis by Tapback. Your choice stays with you for this
                        room.
                    </p>
                </dialog>,
                document.body,
            )}
        </fieldset>
    );
}
