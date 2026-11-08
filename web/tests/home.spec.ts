import { expect, test } from "./teacher-fixture";

for (const width of [320, 390, 768, 1440]) {
    test(`home actions and layouts work at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        await expect(
            page.getByRole("heading", {
                level: 1,
                name: "Big brains. Bigger vibes.",
            }),
        ).toBeVisible();
        await expect(page.locator("article, .mode-card")).toHaveCount(0);
        await expect(page.locator(".home > section")).toHaveCount(2);
        await expect(page.locator("footer")).toHaveCount(0);
        await page.locator(".home").evaluate(async (element) => {
            await Promise.all(
                element
                    .getAnimations({ subtree: true })
                    .map((animation) => animation.finished),
            );
        });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
        const host = await page.locator(".host-action").boundingBox();
        const joining = await page.locator(".join-flow").boundingBox();
        const solo = await page.locator(".solo-action-row").boundingBox();
        expect(host!.y + host!.height).toBeLessThan(joining!.y);
        expect(joining!.y + joining!.height).toBeLessThanOrEqual(solo!.y);
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
        await expect(page.locator(".page-heading h1")).toHaveCount(0);
        await expect(page.locator(".page-heading > p")).toHaveCount(0);
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
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBeTruthy();
    });
}

test("home fits one screen without hiding play controls", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
        page.getByRole("button", { name: "Create a room", exact: true }),
    ).toBeVisible();
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 1280, height: 720 },
        { width: 1024, height: 600 },
        { width: 1000, height: 700 },
        { width: 768, height: 900 },
        { width: 390, height: 844 },
        { width: 320, height: 568 },
    ]) {
        await page.setViewportSize(viewport);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollHeight <= innerHeight,
            ),
        ).toBeTruthy();
        for (const name of ["Create a room", "Join a room", "Play solo"]) {
            await expect(
                page.getByRole("button", { name, exact: true }),
            ).toBeInViewport({ ratio: 1 });
        }
        await expect(
            page.getByLabel("Room code", { exact: true }),
        ).toBeInViewport({
            ratio: 1,
        });
        const kicker = await page.locator(".hero-kicker").boundingBox();
        const headline = await page.locator("#hero-title").boundingBox();
        const perks = await page.locator(".hero-perks").boundingBox();
        const hero = await page.locator(".landing-hero").boundingBox();
        const actions = await page.locator(".play-actions").boundingBox();
        expect(kicker!.y + kicker!.height).toBeLessThanOrEqual(headline!.y);
        expect(headline!.y + headline!.height).toBeLessThanOrEqual(perks!.y);
        if (viewport.width > 1000) {
            expect(hero!.x + hero!.width).toBeLessThan(actions!.x);
            expect(
                Math.abs(
                    hero!.y +
                        hero!.height / 2 -
                        (actions!.y + actions!.height / 2),
                ),
            ).toBeLessThan(2);
            const highlightedLine = await page
                .locator(".hero-line-second")
                .boundingBox();
            expect(
                highlightedLine!.x + highlightedLine!.width + 16,
            ).toBeLessThan(actions!.x);
            const firstLine = await page
                .locator(".hero-line-first")
                .boundingBox();
            const mascot = await page.locator(".hero-mascot").boundingBox();
            const caption = await page
                .locator(".hero-mascot > span")
                .boundingBox();
            const sticker = await page.locator(".hero-sticker").boundingBox();
            const host = await page.locator(".host-action").boundingBox();
            expect(mascot!.x).toBeGreaterThan(firstLine!.x + firstLine!.width);
            expect(
                Math.abs(
                    mascot!.y +
                        mascot!.height / 2 -
                        (firstLine!.y + firstLine!.height / 2),
                ),
            ).toBeLessThan(2);
            expect(mascot!.y + mascot!.height).toBeLessThanOrEqual(
                highlightedLine!.y,
            );
            expect(caption!.y + caption!.height).toBeLessThanOrEqual(
                firstLine!.y,
            );
            expect(sticker!.y + sticker!.height).toBeLessThanOrEqual(host!.y);
            expect(host!.y - (sticker!.y + sticker!.height)).toBeLessThan(32);
            expect(sticker!.x).toBeGreaterThanOrEqual(host!.x);
            expect(sticker!.x + sticker!.width).toBeLessThanOrEqual(
                host!.x + host!.width,
            );
        } else {
            expect(perks!.y + perks!.height).toBeLessThanOrEqual(actions!.y);
            expect(actions!.y - (perks!.y + perks!.height)).toBeLessThanOrEqual(
                32,
            );
            await expect(page.locator(".hero-mascot")).not.toBeVisible();
            await expect(page.locator(".hero-sticker")).not.toBeVisible();
        }
    }
    await page
        .getByRole("button", { name: "Create a room", exact: true })
        .click();
    await expect(page.locator("main")).not.toHaveClass("home-main");
    await expect(page.locator("footer")).toBeVisible();
});

test("light grid is decorative and does not block play controls", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const createButton = page.getByRole("button", {
        name: "Create a room",
        exact: true,
    });
    await expect(createButton).toBeVisible();
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const grid = await page.locator("html").evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                image: style.backgroundImage,
                size: style.backgroundSize,
                animation: style.animationName,
                paper: getComputedStyle(document.documentElement)
                    .backgroundColor,
            };
        });
        expect(grid.image).toContain("radial-gradient");
        expect(grid.size).toBe("24px 24px");
        expect(grid.animation).toBe("none");
        expect(grid.paper).toBe("rgb(250, 247, 239)");
    }
    await createButton.click();
    await expect(
        page.getByRole("group", { name: "Question source" }),
    ).toBeVisible();
    await expect(page.locator(".home-main")).toHaveCount(0);
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

test("pages have no top bar and back navigation supports keyboard input", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/create", "/solo", "/join"]) {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        await expect(page.locator("header, nav")).toHaveCount(0);
    }
    await expect(page.getByLabel("Room code", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to home" }).focus();
    await page.keyboard.press("Enter");
    await expect(
        page.getByRole("heading", { name: "Big brains. Bigger vibes." }),
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
    await expect(page.locator(".hero-line-first")).toHaveCSS(
        "animation-name",
        "none",
    );
});

test("entrance reveals stagger, settle, and replay without breaking hover", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const headline = page.locator(".hero-line-first");
    const hostAction = page.locator(".host-action");
    await expect(headline).toBeVisible();
    await expect(headline).toHaveCSS("animation-name", "blur-reveal");
    const entryDelays = await page
        .locator(".home-entry")
        .evaluateAll((elements) =>
            elements.map((element) =>
                Number.parseFloat(getComputedStyle(element).animationDelay),
            ),
        );
    expect(entryDelays[1]).toBeGreaterThan(entryDelays[0]);
    expect(entryDelays[2]).toBeGreaterThan(entryDelays[1]);
    await expect(hostAction).toHaveCSS("filter", "none");
    await expect(hostAction).toHaveCSS("opacity", "1");
    await expect(hostAction).toHaveCSS("translate", "none");
    await hostAction.hover();
    await expect(hostAction).toHaveCSS(
        "transform",
        "matrix(1, 0, 0, 1, 0, -2)",
    );
    await hostAction.click();
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(headline).toHaveCSS("animation-name", "blur-reveal");
    const animations = await headline.evaluate((element) =>
        element.getAnimations().map((animation) => animation.playState),
    );
    expect(animations).toContain("running");
    await expect(headline).toHaveCSS("filter", "none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(hostAction).toHaveCSS("animation-name", "none");
    await expect(hostAction).toHaveCSS("opacity", "1");
});
