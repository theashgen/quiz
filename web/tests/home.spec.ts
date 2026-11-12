import { expect, test } from "./teacher-fixture";

test("home uses shadcn room-entry primitives", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("group", { name: "Join with a room code" });
    await expect(group.locator("svg")).toHaveCount(0);
    await expect(group).toHaveAttribute("data-slot", "button-group");
    await expect(
        group.getByRole("textbox", { name: "Room code" }),
    ).toHaveAttribute("data-slot", "input");
    await expect(
        group.getByRole("button", { name: "Join a room" }),
    ).toHaveAttribute("data-slot", "button");
    await page
        .getByRole("button", { name: "Create a room", exact: true })
        .click();
    await expect(page.getByRole("menu")).toHaveAttribute(
        "data-slot",
        "dropdown-menu-content",
    );
    await expect(page.getByRole("menuitem").first()).toHaveAttribute(
        "data-slot",
        "dropdown-menu-item",
    );
});

test("room input uses the stock shadcn recipe and focus ring", async ({
    page,
}) => {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "Room code" });
    const group = page.getByRole("group", { name: "Join with a room code" });
    await input.click();
    await expect(input).toBeFocused();
    await expect(group).toHaveCSS("outline-style", "none");
    await expect(input).toHaveCSS("outline-style", "none");
    await expect(input).toHaveAttribute("data-variant", "default");
    await expect(input).toHaveCSS("border-top-width", "1px");
    await expect(input).toHaveCSS("border-top-left-radius", "8px");
    await expect(input).not.toHaveCSS("box-shadow", "none");
    await expect(input).toHaveCSS("border-color", "rgb(245, 128, 56)");
    await input.fill("ABC123");
    await page.keyboard.press("Tab");
    await expect(
        page.getByRole("button", { name: "Join a room" }),
    ).toBeFocused();
});

test("create-room button has no hover or press animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const button = page.getByRole("button", {
        name: "Create a room",
        exact: true,
    });
    const background = await button.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
    );
    const bounds = await button.boundingBox();
    await button.hover();
    expect(await button.boundingBox()).toEqual(bounds);
    await page.mouse.down();
    await expect(button).toHaveCSS("animation-name", "none");
    await expect(button).toHaveCSS("transition-duration", "0s");
    await expect(button).toHaveCSS(
        "transform",
        /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
    );
    await expect(button).toHaveCSS("scale", "none");
    expect(await button.boundingBox()).toEqual(bounds);
    await expect(button).toHaveCSS("background-color", background);
    await page.mouse.up();
});

test("minimal header links teachers directly to their question bank", async ({
    page,
    browser,
    baseURL,
}) => {
    await page.goto("/");
    await expect(
        page.getByRole("navigation", { name: "Primary navigation" }),
    ).toHaveCount(0);
    await expect(page.locator(".playground-footnote")).toHaveCount(0);
    await expect(
        page.getByText("Made for good company", { exact: false }),
    ).toHaveCount(0);
    await page
        .getByRole("button", { name: "Question bank", exact: true })
        .click();
    await expect(page).toHaveURL(/\/create\?source=custom$/);
    await expect(page.locator(".custom-editor")).toBeVisible();
    await expect(
        page.getByRole("button", { name: /Your own questions/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator(".custom-editor")).toBeVisible();
    const guestContext = await browser.newContext({ baseURL });
    try {
        const guest = await guestContext.newPage();
        await guest.goto("/");
        await expect(
            guest.getByRole("heading", {
                name: "Good questions. Great company.",
            }),
        ).toBeVisible();
        await expect(
            guest.getByRole("button", { name: "Question bank", exact: true }),
        ).toHaveCount(0);
        await expect(
            guest.getByRole("navigation", { name: "Primary navigation" }),
        ).toHaveCount(0);
    } finally {
        await guestContext.close();
    }
});

test("home restores the dotted grid background", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveCSS(
        "background-image",
        /radial-gradient/,
    );
    await expect(page.locator("html")).toHaveCSS(
        "background-size",
        "24px 24px",
    );
});

test("desktop puts heading and actions left with artwork right", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const intro = page.locator(".playground-intro");
    await expect(
        intro.getByRole("region", { name: "Start playing" }),
    ).toBeVisible();
    const actions = await page.locator(".playground-modes").boundingBox();
    await expect(page.locator("#hero-title, .playground-kicker")).toHaveCount(
        0,
    );
    const description = intro.locator(".home-action-description");
    await expect(description).toBeVisible();
    const showcase = await page.locator(".playground-showcase").boundingBox();
    const host = await page.locator(".mode-host").boundingBox();
    const join = await page.locator(".join-flow").boundingBox();
    expect(showcase!.x).toBeGreaterThanOrEqual(actions!.x + actions!.width);
    const heading = page.getByRole("heading", {
        level: 1,
        name: "Good questions. Great company.",
    });
    await expect(heading).toBeVisible();
    const headingBox = await heading.boundingBox();
    const descriptionBox = await description.boundingBox();
    expect(descriptionBox!.y).toBeGreaterThan(
        headingBox!.y + headingBox!.height,
    );
    expect(actions!.y).toBeGreaterThan(
        descriptionBox!.y + descriptionBox!.height,
    );
    expect(
        Math.abs(join!.y + join!.height / 2 - host!.y - host!.height / 2),
    ).toBeLessThan(1);
    await expect(
        page.getByRole("heading", { name: /Bring your people|Got an invite/ }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("region", { name: "Start playing" }).getByRole("button"),
    ).toHaveCount(2);
    const joinGroup = page.getByRole("group", {
        name: "Join with a room code",
    });
    await expect(
        joinGroup.getByRole("textbox", { name: "Room code" }),
    ).toBeVisible();
    await expect(
        joinGroup.getByRole("button", { name: "Join a room" }),
    ).toBeDisabled();
    await expect(page.getByLabel("Room code", { exact: true })).toHaveAttribute(
        "placeholder",
        "Enter a room code",
    );
    await expect(page.locator(".solo-action-row")).toHaveCount(0);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.locator(".playground-community")).toBeInViewport();
    const community = await intro
        .locator(".playground-community")
        .boundingBox();
    expect(community!.y).toBeGreaterThan(actions!.y + actions!.height);
    expect(Math.abs(community!.x - actions!.x)).toBeLessThan(1);
    await expect(
        page.locator(".playground-showcase .playground-community"),
    ).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Create a room", exact: true }),
    ).toBeInViewport();
});

test("home hides its scrollbar while keeping mobile content scrollable", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 568 });
    await page.goto("/");
    const home = page.locator(".peach-home");
    await expect(home).toHaveCSS("scrollbar-width", "none");
    await expect(home).toHaveCSS("overflow-y", "auto");
    expect(
        await home.evaluate(
            (element) =>
                getComputedStyle(element, "::-webkit-scrollbar").display,
        ),
    ).toBe("none");
    expect(
        await home.evaluate(
            (element) => element.scrollHeight > element.clientHeight,
        ),
    ).toBeTruthy();
    await home.hover();
    await page.mouse.wheel(0, 500);
    await expect
        .poll(() => home.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    await home.locator(".playground-showcase").scrollIntoViewIfNeeded();
    await expect(home.locator(".playground-showcase")).toBeInViewport();
});

test("mobile puts actions before supporting artwork", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(
        page.getByRole("button", { name: "Create a room", exact: true }),
    ).toBeInViewport();
    const actions = await page.locator(".playground-modes").boundingBox();
    const showcase = await page.locator(".playground-showcase").boundingBox();
    const host = await page.locator(".mode-host").boundingBox();
    const join = await page.locator(".join-flow").boundingBox();
    expect(showcase!.y).toBeGreaterThanOrEqual(actions!.y + actions!.height);
    expect(join!.y).toBeGreaterThanOrEqual(host!.y + host!.height);
});

for (const width of [320, 390, 768, 1440]) {
    test(`home actions and layouts work at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        await expect(
            page.getByRole("region", { name: "Start playing" }),
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        await expect(page.getByLabel("Room code", { exact: true })).toHaveCSS(
            "font-size",
            width >= 768 ? "14px" : "16px",
        );
        const joinButton = page.getByRole("button", {
            name: "Join a room",
            exact: true,
        });
        await expect(
            joinButton.getByText("Join", { exact: true }),
        ).toBeVisible();
        expect((await joinButton.boundingBox())!.height).toBeGreaterThanOrEqual(
            44,
        );
        await page
            .getByRole("button", { name: "Create a room", exact: true })
            .click();
        await page.getByRole("menuitem", { name: /Host with friends/ }).click();
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
            .getByRole("button", { name: "Create a room", exact: true })
            .click();
        await page.getByRole("menuitem", { name: /Create solo room/ }).click();
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
    await page.getByLabel("Room code", { exact: true }).fill("ABC123");
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
        for (const name of ["Create a room", "Join a room"]) {
            const action = page.getByRole("button", { name, exact: true });
            await action.scrollIntoViewIfNeeded();
            await expect(action).toBeInViewport({ ratio: 0.99 });
        }
        const input = page.getByLabel("Room code", { exact: true });
        await input.scrollIntoViewIfNeeded();
        await expect(input).toBeInViewport({ ratio: 0.99 });
        await page
            .getByRole("button", { name: "Create a room", exact: true })
            .click();
        for (const name of [/Host with friends/, /Create solo room/]) {
            await expect(page.getByRole("menuitem", { name })).toBeInViewport({
                ratio: 0.99,
            });
        }
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).toHaveCount(0);
    }
    await page
        .getByRole("button", { name: "Create a room", exact: true })
        .click();
    await page.getByRole("menuitem", { name: /Host with friends/ }).click();
    await expect(page.locator("main")).not.toHaveClass("home-main");
    await expect(page.locator("footer")).toBeVisible();
});

test("room menu supports keyboard selection, Escape, and outside dismissal", async ({
    page,
}) => {
    await page.goto("/");
    const trigger = page.getByRole("button", {
        name: "Create a room",
        exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
        page.getByRole("menuitem", { name: /Host with friends/ }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page
        .getByRole("heading", { name: "Good questions. Great company." })
        .click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("menuitem", { name: /Host with friends/ }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
        page.getByRole("menuitem", { name: /Create solo room/ }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/solo$/);
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
        ).toHaveCount(0);
    }
    await expect(page.getByLabel("Room code", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to home" }).focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("region", { name: "Start playing" }),
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
});
