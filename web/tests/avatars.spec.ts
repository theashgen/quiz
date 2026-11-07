import { test, expect } from "@playwright/test";

test("all Memojis load locally and the picker works on small screens", async ({
    page,
}) => {
    await page.goto("/create");
    for (const viewport of [
        { width: 1280, height: 720 },
        { width: 390, height: 844 },
        { width: 320, height: 568 },
        { width: 640, height: 360 },
    ]) {
        await page.setViewportSize(viewport);
        await page.getByRole("button", { name: "Browse all" }).click();
        const dialog = page.getByRole("dialog", {
            name: "Find your quiz face.",
        });
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole("button", { name: /^Avatar \d+$/ }),
        ).toHaveCount(58);
        await expect
            .poll(() =>
                dialog
                    .locator("img")
                    .evaluateAll((images) =>
                        images.every(
                            (image) => image.complete && image.naturalWidth > 0,
                        ),
                    ),
            )
            .toBeTruthy();
        expect(
            await dialog.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
            ),
        ).toBeTruthy();
        await dialog
            .getByRole("button", { name: "Avatar 58", exact: true })
            .click();
        await expect(dialog).not.toBeVisible();
        await expect(
            page.getByRole("button", { name: "Avatar 58", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    }
    await page.getByRole("button", { name: "Browse all" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
        page.getByRole("button", { name: "Browse all" }),
    ).toBeFocused();
});

test("chosen Memojis persist through room creation and joining", async ({
    page,
    browser,
}) => {
    await page.goto("/create");
    await page.getByLabel("Your name").fill("Memoji Host");
    await page.getByRole("button", { name: "Browse all" }).click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Avatar 58", exact: true })
        .click();
    await page.getByRole("button", { name: "Create my room" }).click();
    await expect(
        page.getByRole("heading", { name: "Your people" }),
    ).toBeVisible();
    const host = page.locator(".player").filter({ hasText: "Memoji Host" });
    await expect(host.locator("img")).toHaveAttribute(
        "src",
        "/avatars/tapback/58.webp",
    );
    const code = (await page.locator(".room-code").innerText()).slice(0, 6);
    const context = await browser.newContext({
        baseURL: new URL(page.url()).origin,
        ignoreHTTPSErrors: true,
    });
    try {
        const guest = await context.newPage();
        await guest.goto(`/join?code=${code}`);
        await guest.getByLabel("Your name").fill("Memoji Guest");
        await guest.getByRole("button", { name: "Browse all" }).click();
        await guest
            .getByRole("dialog")
            .getByRole("button", { name: "Avatar 42", exact: true })
            .click();
        await guest.getByRole("button", { name: "Join the room" }).click();
        await expect(
            guest.getByRole("heading", { name: "Your people" }),
        ).toBeVisible();
        for (const lobby of [page, guest]) {
            await expect(
                lobby
                    .locator(".player")
                    .filter({ hasText: "Memoji Guest" })
                    .locator("img"),
            ).toHaveAttribute("src", "/avatars/tapback/42.webp");
            await expect(
                lobby
                    .locator(".player")
                    .filter({ hasText: "Memoji Host" })
                    .locator("img"),
            ).toHaveAttribute("src", "/avatars/tapback/58.webp");
        }
        await guest.reload();
        await expect(
            guest
                .locator(".player")
                .filter({ hasText: "Memoji Guest" })
                .locator("img"),
        ).toHaveAttribute("src", "/avatars/tapback/42.webp");
    } finally {
        await context.close();
    }
});
