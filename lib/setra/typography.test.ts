import assert from "node:assert/strict";
import {readdirSync,readFileSync,statSync} from "node:fs";
import {join,relative,resolve} from "node:path";
import test from "node:test";

const projectRoot=resolve(import.meta.dirname,"../..");
const productRoots=["app","components","lib","public"];
const textExtensions=new Set([".css",".html",".js",".json",".md",".svg",".ts",".tsx",".txt",".webmanifest"]);

function filesUnder(directory:string):string[]{
  return readdirSync(directory).flatMap(name=>{
    const path=join(directory,name);
    if(statSync(path).isDirectory())return filesUnder(path);
    return textExtensions.has(name.slice(name.lastIndexOf(".")))?[path]:[];
  });
}

test("product copy never contains an em dash",()=>{
  const offenders=productRoots.flatMap(root=>filesUnder(join(projectRoot,root))).filter(path=>readFileSync(path,"utf8").includes("\u2014")).map(path=>relative(projectRoot,path));
  assert.deepEqual(offenders,[],`Replace em dashes with en dashes in: ${offenders.join(", ")}`);
});
