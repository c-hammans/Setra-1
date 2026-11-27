import {defineConfig,devices} from "@playwright/test";

const existingPreview=process.env.PLAYWRIGHT_BASE_URL;
const baseURL=existingPreview||"http://localhost:3100";
export default defineConfig({testDir:"./tests/browser",fullyParallel:false,retries:0,use:{baseURL,...devices["Desktop Chrome"],channel:"chrome"},webServer:existingPreview?undefined:{command:"pnpm dev --port 3100",url:baseURL+"/test-use-previous",reuseExistingServer:true,timeout:120_000}});
