import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const test = base.extend({
    page: async ({ page, baseURL }, use) => {
        const origin = new URL(baseURL ?? "http://localhost:8443").origin;
        const response = await page.request.post("/api/auth/signup", {
            headers: { Origin: origin },
            data: {
                name: "Test Teacher",
                email: `teacher-${randomUUID()}@example.test`,
                password: "Test teacher passphrase 2026",
                role: "teacher",
            },
        });
        expect(response.status(), await response.text()).toBe(201);
        await use(page);
    },
});
export { expect };
