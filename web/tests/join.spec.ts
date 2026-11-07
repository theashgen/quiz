import { test, expect } from "@playwright/test";

test.describe("mobile avatar swiping", () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

    test("swipes cycle and wrap without replacing vertical scrolling or taps", async ({
        page,
    }) => {
        await page.goto("/join");
        await page.getByRole("button", { name: "Browse all" }).click();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Avatar 1", exact: true })
            .click();
        const face = page.locator(".avatar-carousel-face");
        await expect(
            page.getByText("Swipe left or right to find your face"),
        ).toBeVisible();
        await expect(face).toHaveCSS("touch-action", "pan-y pinch-zoom");

        async function swipe(horizontal: number, vertical = 0, cancel = false) {
            await face.evaluate(
                (element, gesture) => {
                    const start = new Touch({
                        identifier: 1,
                        target: element,
                        clientX: 200,
                        clientY: 200,
                    });
                    element.dispatchEvent(
                        new TouchEvent("touchstart", {
                            bubbles: true,
                            touches: [start],
                            changedTouches: [start],
                        }),
                    );
                    const end = new Touch({
                        identifier: 1,
                        target: element,
                        clientX: 200 + gesture.horizontal,
                        clientY: 200 + gesture.vertical,
                    });
                    element.dispatchEvent(
                        new TouchEvent(
                            gesture.cancel ? "touchcancel" : "touchend",
                            {
                                bubbles: true,
                                touches: [],
                                changedTouches: [end],
                            },
                        ),
                    );
                },
                { horizontal, vertical, cancel },
            );
        }

        await swipe(-90);
        await expect(page.getByRole("status")).toHaveText("Avatar 2 of 58");
        await swipe(90);
        await expect(page.getByRole("status")).toHaveText("Avatar 1 of 58");
        await swipe(90);
        await expect(page.getByRole("status")).toHaveText("Avatar 58 of 58");
        await swipe(-90);
        await expect(page.getByRole("status")).toHaveText("Avatar 1 of 58");
        await swipe(5);
        await swipe(10, 100);
        await swipe(-90, 0, true);
        await expect(page.getByRole("status")).toHaveText("Avatar 1 of 58");
        await page.getByRole("button", { name: "Next avatar" }).click();
        await expect(page.getByRole("status")).toHaveText("Avatar 2 of 58");
    });
});

test("join page uses laptop space and stays within mobile widths", async ({
    page,
}) => {
    await page.goto("/join?code=ABC123");
    await expect(page.getByLabel("Room code")).toHaveValue("ABC123");
    await expect(page.getByLabel("Your name")).toBeFocused();
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1024, height: 768 },
        { width: 390, height: 844 },
        { width: 320, height: 568 },
    ]) {
        await page.setViewportSize(viewport);
        const welcome = await page.locator(".join-welcome").boundingBox();
        const form = await page.locator(".join-form-panel").boundingBox();
        expect(welcome).not.toBeNull();
        expect(form).not.toBeNull();
        if (viewport.width > 740) {
            const layout = await page.locator(".join-layout").boundingBox();
            expect(layout!.width).toBeGreaterThan(viewport.width * 0.85);
            expect(layout!.height).toBeGreaterThan(viewport.height * 0.65);
            const joinButton = await page
                .getByRole("button", { name: "Join the room" })
                .boundingBox();
            expect(joinButton!.y + joinButton!.height).toBeLessThan(
                viewport.height,
            );
            expect(form!.x).toBeGreaterThan(welcome!.x + welcome!.width - 1);
            const name = await page.getByLabel("Your name").boundingBox();
            expect(name!.x + name!.width).toBeLessThanOrEqual(form!.x);
        } else {
            expect(form!.y).toBeGreaterThan(welcome!.y);
        }
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    }
});

test("avatar arrows wrap and the name stays required across both panels", async ({
    page,
}) => {
    await page.goto("/join?code=ABC123");
    await page.getByRole("button", { name: "Browse all" }).click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Avatar 1", exact: true })
        .click();
    await page.getByRole("button", { name: "Previous avatar" }).click();
    await expect(page.getByRole("status")).toHaveText("Avatar 58 of 58");
    await page.getByRole("button", { name: "Next avatar" }).click();
    await expect(page.getByRole("status")).toHaveText("Avatar 1 of 58");
    await page.getByRole("button", { name: "Join the room" }).click();
    await expect(page.getByLabel("Your name")).toBeFocused();
    await expect(page).toHaveURL(/\/join\?code=ABC123$/);
});

test("join preview reflects the name and selected avatar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/join");
    await page.getByLabel("Your name").fill("Quiz Friend");
    await expect(page.getByLabel("Your name")).toHaveValue("Quiz Friend");
    await page.getByRole("button", { name: "Browse all" }).click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Avatar 42", exact: true })
        .click();
    await expect(page.locator(".avatar-carousel-face img")).toHaveAttribute(
        "src",
        "/avatars/tapback/42.webp",
    );
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: "Next avatar" }).click();
    await expect(page.locator(".avatar-carousel-face img")).toHaveAttribute(
        "src",
        "/avatars/tapback/43.webp",
    );
    await page.getByRole("button", { name: "Previous avatar" }).click();
    await expect(page.locator(".avatar-carousel-face img")).toHaveAttribute(
        "src",
        "/avatars/tapback/42.webp",
    );
    await page.getByLabel("Room code").fill("abc123");
    await expect(page.getByLabel("Room code")).toHaveValue("ABC123");
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/$/);
});
