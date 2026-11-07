import { expect, test } from "@playwright/test";

test("local HTTP keeps a guest session without weakening origin checks", async ({
    page,
    context,
    baseURL,
}) => {
    test.skip(
        !baseURL || new URL(baseURL).protocol !== "http:",
        "Local HTTP only",
    );
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Big brains. Bigger vibes." }),
    ).toBeVisible();
    const guest = (await context.cookies()).find(
        (cookie) => cookie.name === "quiz_guest_local",
    );
    expect(guest).toMatchObject({
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        path: "/",
    });
    await page.reload();
    await expect(
        page.getByRole("heading", { name: "Big brains. Bigger vibes." }),
    ).toBeVisible();
    const restoredGuest = (await context.cookies()).find(
        (cookie) => cookie.name === "quiz_guest_local",
    );
    expect(restoredGuest?.value).toBe(guest?.value);
    const rejected = await page.request.post("/api/session", {
        headers: { Origin: "http://untrusted.test" },
        data: {},
    });
    expect(rejected.status()).toBe(403);
});
