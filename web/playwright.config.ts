import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "tests",
    timeout: 60000,
    expect: { timeout: 10000 },
    workers: 1,
    use: {
        baseURL: process.env.APP_URL ?? "http://localhost:8443",
        ignoreHTTPSErrors: true,
        trace: "retain-on-failure",
    },
    reporter: "list",
    outputDir: "../.local/playwright-results",
});
