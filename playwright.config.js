import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);

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
    baseURL: `http://127.0.0.1:${port}`,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}} : {}),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {name:"labor-projection-desktop",testMatch:/labor-projection\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"labor-projection-mobile",testMatch:/labor-projection\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"pdf-mrc",testMatch:/pdf-mrc\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"clt-desktop",testMatch:/clt-payslips\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"clt-mobile",testMatch:/clt-payslips\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"payroll-closing-desktop",testMatch:/payroll-closing\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"payroll-closing-mobile",testMatch:/payroll-closing\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"erp-navigation-desktop",testMatch:/erp-navigation\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"erp-navigation-mobile",testMatch:/erp-navigation\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"annual-dre-desktop",testMatch:/annual-dre\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"annual-dre-mobile",testMatch:/annual-dre\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"dre-reconciliation-desktop",testMatch:/dre-reconciliation\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"dre-reconciliation-mobile",testMatch:/dre-reconciliation\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {name:"reconciliation-categories-desktop",testMatch:/reconciliation-categories\.spec\.js/,use:{browserName:"chromium",viewport:{width:1440,height:1000}}},
    {name:"reconciliation-categories-mobile",testMatch:/reconciliation-categories\.spec\.js/,use:{browserName:"chromium",viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
    {
      name: "purchase-workspace",
      testMatch: /purchase-workspace\.spec\.js/,
      use: { browserName:"chromium", viewport:{width:1440,height:1000} },
    },
    { name: "equipe-obras-desktop", testMatch: /equipe-obras(?:-tv)?\.spec\.js/, use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
    { name: "equipe-obras-mobile", testMatch: /equipe-obras(?:-tv)?\.spec\.js/, use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    mobileProject("mobile-320x568", 320, 568),
    mobileProject("mobile-360x800", 360, 800),
    mobileProject("mobile-390x844", 390, 844),
    mobileProject("mobile-430x932", 430, 932),
    mobileProject("tablet-768x1024", 768, 1024),
    mobileProject("mobile-landscape-844x390", 844, 390),
    {
      name: "desktop-module-smoke",
      testMatch: /modules-smoke\.spec\.js/,
      use: { browserName:"chromium", viewport:{width:1440,height:900} },
    },
    {
      name: "desktop-equipment-rentals",
      testMatch: /equipment-rentals\.spec\.js/,
      use: { browserName:"chromium", viewport:{width:1440,height:900} },
    },
    {
      name: "desktop-billing-center",
      testMatch: /billing-center\.spec\.js/,
      use: { browserName:"chromium", viewport:{width:1440,height:900} },
    },
    {
      name: "desktop-critical-actions",
      testMatch: /critical-actions\.spec\.js/,
      use: { browserName:"chromium", viewport:{width:1440,height:900} },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
