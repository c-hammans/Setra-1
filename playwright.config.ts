import {defineConfig,devices} from "@playwright/test";

export default defineConfig({testDir:"./tests/browser",fullyParallel:false,retries:0,use:{baseURL:"http://localhost:3100",...devices["Desktop Chrome"],channel:"chrome"},webServer:{command:"pnpm dev --port 3100",url:"http://localhost:3100/test-use-previous",reuseExistingServer:true,timeout:120_000}});
