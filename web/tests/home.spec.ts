import { expect, test } from "./teacher-fixture";

for (const width of [320, 390, 768, 1440]) {
    test(`home actions and layouts work at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        await expect(
            page.getByRole("heading", {
                level: 1,
                name: "Play together. Grow curious.",
            }),
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        await expect(page.getByLabel("Room code", { exact: true })).toHaveCSS(
            "font-size",
            "16px",
        );
        await page
            .getByRole("button", { name: "Create a room", exact: true })
            .click();
        await expect(page).toHaveURL(/\/create$/);
        await expect(
            page.getByRole("group", { name: "Question source" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Back to home" }).click();
        await page.getByLabel("Room code", { exact: true }).fill("abc123");
        await page
            .getByRole("button", { name: "Join a room", exact: true })
            .click();
        await expect(page).toHaveURL(/\/join\?code=ABC123$/);
        await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
            "ABC123",
        );
        await expect(page.getByLabel("Your name")).toBeFocused();
        await page.getByRole("button", { name: "Back to home" }).click();
        await page
            .getByRole("button", { name: "Play solo", exact: true })
            .click();
        await expect(
            page.getByRole("heading", { name: "Follow your curiosity." }),
        ).toBeVisible();
    });
}

test("all play modes remain reachable from small phones to desktop", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1280, height: 720 },
        { width: 1024, height: 600 },
        { width: 768, height: 900 },
        { width: 390, height: 844 },
        { width: 320, height: 568 },
    ]) {
        await page.setViewportSize(viewport);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        for (const name of ["Create a room", "Join a room", "Play solo"]) {
            const action = page.getByRole("button", { name, exact: true });
            await action.scrollIntoViewIfNeeded();
            await expect(action).toBeInViewport({ ratio: 0.99 });
        }
        const input = page.getByLabel("Room code", { exact: true });
        await input.scrollIntoViewIfNeeded();
        await expect(input).toBeInViewport({ ratio: 0.99 });
    }
    await page
        .getByRole("button", { name: "Create a room", exact: true })
        .click();
    await expect(page.locator("main")).not.toHaveClass("home-main");
    await expect(page.locator("footer")).toBeVisible();
});

test("room codes validate before joining and survive a refresh", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const codeInput = page.getByLabel("Room code", { exact: true });
    const joinButton = page.getByRole("button", {
        name: "Join a room",
        exact: true,
    });
    await expect(joinButton).toBeDisabled();
    await codeInput.fill("abc12");
    await expect(codeInput).toHaveValue("ABC12");
    await expect(joinButton).toBeDisabled();
    await codeInput.press("Enter");
    await expect(page).toHaveURL(/\/$/);
    await codeInput.fill(" a-b c1_2!3xyz ");
    await expect(codeInput).toHaveValue("ABC123");
    await expect(joinButton).toBeEnabled();
    await codeInput.press("Enter");
    await expect(page).toHaveURL(/\/join\?code=ABC123$/);
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
    await expect(page.getByLabel("Your name")).toBeFocused();
    await page.reload();
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
    await expect(page.getByLabel("Your name")).toBeFocused();
});

test("direct join links normalize their code and let players edit it", async ({
    page,
}) => {
    await page.goto("/join?code=%20ab-c123xyz%20");
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "ABC123",
    );
    await expect(page.getByLabel("Your name")).toBeFocused();
    await page.getByLabel("Room code", { exact: true }).fill("def456");
    await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
        "DEF456",
    );
});

test("shared navigation and back actions support keyboard input", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/create", "/solo", "/join"]) {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.getByRole("banner")).toBeVisible();
        await expect(
            page.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeVisible();
    }
    await expect(page.getByLabel("Room code", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to home" }).focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("heading", { name: "Play together. Grow curious." }),
    ).toBeVisible();
    await page.getByLabel("Room code", { exact: true }).fill("ABC123");
    await page
        .getByRole("button", { name: "Join a room", exact: true })
        .focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Your name")).toBeFocused();
});

test("reduced motion removes decorative transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const hostAction = page.locator(".host-action");
    await expect(hostAction).toBeVisible();
    await expect(hostAction).toHaveCSS("transition-duration", "0s");
    await expect(hostAction).toHaveCSS("animation-name", "none");
    await expect(hostAction).toHaveCSS("opacity", "1");
    await expect(hostAction).toHaveCSS("filter", "none");
    await expect(page.locator("#hero-title")).toHaveCSS(
        "animation-name",
        "none",
    );
});
