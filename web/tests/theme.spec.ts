import { expect, test } from "@playwright/test";

test("shared dotted canvas stays consistent across pages and screen sizes", async ({
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
                    /radial-gradient/,
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
