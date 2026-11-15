import assert from "node:assert/strict";
import test from "node:test";
import {contrastRatio,createSetraTheme} from "./appearance.ts";

const accents=["#409ECE","#FF6B6B","#F6C445","#55B96D","#8B72D9","#6B7280"];
const token=(theme:ReturnType<typeof createSetraTheme>,name:string)=>String((theme as Record<string,unknown>)[name]);

for(const mode of ["light","dark"] as const){
  test(`semantic text contrast passes in ${mode} mode for every accent`,()=>{
    for(const accent of accents){
      const theme=createSetraTheme(accent,mode,1);
      const page=token(theme,"--surface-page");
      const card=token(theme,"--surface-card");
      assert.ok(contrastRatio(token(theme,"--text-primary"),page)>=7,accent);
      assert.ok(contrastRatio(token(theme,"--text-secondary"),card)>=4.5,accent);
      assert.ok(contrastRatio(token(theme,"--text-muted"),card)>=3,accent);
      assert.ok(contrastRatio(token(theme,"--border-control"),card)>=3,accent);
      assert.ok(contrastRatio(token(theme,"--accent-ink"),token(theme,"--accent-tint"))>=4.5,accent);
      assert.ok(contrastRatio(token(theme,"--accent-contrast"),accent)>=4.5,accent);
      assert.ok(contrastRatio(token(theme,"--success"),token(theme,"--success-surface"))>=4.5,accent);
      assert.ok(contrastRatio(token(theme,"--destructive"),token(theme,"--destructive-surface"))>=4.5,accent);
    }
  });
}
