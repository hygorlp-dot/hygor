import { defineConfig } from "@playwright/test";

const mobileProject = (name, width, height) => ({
  name,
  testMatch: /ponto\.spec\.js/,
  use: {
    browserName: "chromium",
    viewport: { width, height },
    hasTouch: true,
    isMobile: width < 600,
  },
});

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    mobileProject("mobile-320x568", 320, 568),
    mobileProject("mobile-360x800", 360, 800),
    mobileProject("mobile-390x844", 390, 844),
    mobileProject("mobile-430x932", 430, 932),
    mobileProject("tablet-768x1024", 768, 1024),
    mobileProject("mobile-landscape-844x390", 844, 390),
    {
      name: "desktop-module-smoke",
      testMatch: /(modules-smoke|financial-hub)\.spec\.js/,
      use: { browserName:"chromium", viewport:{width:1440,height:900} },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
