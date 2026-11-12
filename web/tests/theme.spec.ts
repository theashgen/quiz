import { expect, test } from "./teacher-fixture";

test("single-sided dividers stay thin across join and custom setup screens", async ({
    page,
}) => {
    async function borders(selector: string, widths: number[]) {
        const element = page.locator(selector);
        await expect(element).toBeVisible();
        expect(
            await element.evaluate((node) => {
                const style = getComputedStyle(node);
                return [
                    style.borderTopWidth,
                    style.borderRightWidth,
                    style.borderBottomWidth,
                    style.borderLeftWidth,
                ].map(parseFloat);
            }),
        ).toEqual(widths);
    }

    for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/join");
        await borders(".join-layout", [1, 1, 1, 1]);
        await borders(
            ".join-welcome",
            width > 740 ? [0, 1, 0, 0] : [0, 0, 1, 0],
        );
        if (width > 740) {
            await borders(".join-entry-note", [1, 0, 0, 0]);
        } else {
            await expect(page.locator(".join-entry-note")).toBeHidden();
        }

        await page.goto("/create");
        await page.getByRole("button", { name: "Your own questions" }).click();
        await borders(".custom-editor", [0, 0, 0, 0]);
        await borders(".editor-question", [0, 0, 1, 0]);
        await borders(".saved-quizzes", [0, 0, 1, 0]);
        await borders(
            ".setup-aside",
            width > 740 ? [0, 0, 0, 0] : [1, 0, 0, 0],
        );
    }
});

test("shared dotted cream canvas stays consistent across pages and screen sizes", async ({
    page,
}) => {
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ["/", "/join", "/create", "/solo"]) {
            await page.goto(path);
            await expect(
                page.locator("main h1, main h2").first(),
            ).toBeVisible();
            await expect(page.locator("html")).toHaveCSS(
                "background-color",
                "rgb(250, 247, 240)",
            );
            await expect(page.locator("html")).toHaveCSS(
                "background-image",
                /radial-gradient/,
            );
            await expect(page.locator("html")).toHaveCSS(
                "background-size",
                "24px 24px",
            );
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            ).toBeTruthy();
            if (path === "/join") {
                await expect(page.locator(".join-welcome")).toHaveCSS(
                    "background-image",
                    "none",
                );
                await expect(page.locator(".join-layout")).toHaveCSS(
                    "background-image",
                    "none",
                );
            }
        }
    }
});

test("micro interactions respond to input and respect reduced motion", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/join");
    const avatar = page.locator(".avatar-carousel-face img");
    await expect(avatar).toHaveCSS("animation-name", "avatar-switch");
    await page.getByRole("button", { name: "Next avatar" }).click();
    await expect(avatar).toHaveCSS("animation-name", "avatar-switch");
    const name = page.getByLabel("Your name");
    await name.focus();
    await expect(name).toHaveCSS("box-shadow", /rgba?\(/);
    const join = page.getByRole("button", { name: "Join the room" });
    await join.hover();
    await page.mouse.down();
    await expect(join).toHaveCSS("scale", "0.97");
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(avatar).toHaveCSS("animation-name", "none");
    await expect(join).toHaveCSS("transition-duration", "0s");
});
