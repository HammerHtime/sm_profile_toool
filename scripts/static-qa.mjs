import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const fail=(message)=>{ console.error("QA FAIL:",message); process.exitCode=1; };
const pass=(message)=>console.log("QA PASS:",message);

const pairs=[
  ["index.html","app.js"],
  ["presenter.html","presenter.js"],
  ["volunteer.html","volunteer.js"]
];

for(const [htmlPath,jsPath] of pairs){
  const html=read(htmlPath);
  const js=read(jsPath);
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  const idSet=new Set(ids);
  const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
  if(duplicates.length) fail(htmlPath+" duplicate IDs: "+duplicates.join(", "));
  else pass(htmlPath+" has unique IDs");

  const refs=[...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m=>m[1]);
  const missing=[...new Set(refs.filter(id=>!idSet.has(id)))];
  if(missing.length) fail(jsPath+" references missing IDs: "+missing.join(", "));
  else pass(jsPath+" DOM ID references resolve");

  if(/\\n/.test(html)) fail(htmlPath+" contains a literal \\n escape");
  else pass(htmlPath+" contains no stray literal newline escapes");

  const buttons=[...html.matchAll(/<button\b(?![^>]*\btype=)[^>]*>/gi)];
  if(buttons.length) fail(htmlPath+" has buttons without explicit type");
  else pass(htmlPath+" buttons have explicit types");
}

const scripts=[
  "app.js","presenter.js","volunteer.js",
  ...fs.readdirSync(path.join(root,"netlify/functions"))
    .filter(name=>name.endsWith(".mjs"))
    .map(name=>"netlify/functions/"+name)
];

for(const script of scripts){
  try{
    execFileSync(process.execPath,["--check",path.join(root,script)],{stdio:"pipe"});
    pass(script+" syntax");
  }catch(error){
    fail(script+" syntax error\n"+String(error.stderr||error.message));
  }
}

const app=read("app.js");
const presenter=read("presenter.js");
const netlify=read("netlify.toml");
const daily=read("netlify/functions/daily-purge.mjs");
const live=read("netlify/functions/live-search.mjs");

const liveMin=Number(app.match(/MIN_LIVE_SEARCH_MS\s*=\s*(\d+)/)?.[1]||0);
const photoMin=Number(presenter.match(/MIN_PHOTO_SEARCH_MS\s*=\s*(\d+)/)?.[1]||0);
if(liveMin<14000) fail("Live search cinematic minimum is below 14 seconds");
else pass("Live search cinematic minimum >= 14 seconds");
if(photoMin<14000) fail("Photo search cinematic minimum is below 14 seconds");
else pass("Photo search cinematic minimum >= 14 seconds");

if(!live.includes('path:"/api/live-search"')) fail("Live search custom route is missing");
else pass("Live search custom route exists");
if(!netlify.includes("https://imgs.search.brave.com")) fail("CSP does not allow Brave privacy-proxy thumbnails");
else pass("CSP allows Brave privacy-proxy thumbnails");
if(!netlify.includes("microphone=(self)")) fail("Microphone permission policy is missing");
else pass("Microphone permission policy enabled for same origin");
if(!daily.includes('schedule:"0 9 * * *"')) fail("Daily failsafe purge schedule is missing");
else pass("Daily failsafe purge schedule exists");
if(!presenter.includes("ALL DEMO DATA DELETED")) fail("Presenter erase confirmation is missing");
else pass("Presenter erase confirmation exists");
if(!app.includes("SYNTHETIC DEMONSTRATION DATA")) fail("Synthetic provenance banner is missing");
else pass("Synthetic provenance banner exists");

if(!app.includes("function platformRowsFor(")) fail("Social privacy walkthrough row renderer is missing");
else pass("Social privacy walkthrough row renderer exists");
if(!app.includes("function platformHeaderFor(")) fail("Social privacy walkthrough header renderer is missing");
else pass("Social privacy walkthrough header renderer exists");
if(!app.includes("phoneSceneNativeIncoming")) fail("Native-style phone screen transition is missing");
else pass("Native-style phone screen transition exists");

const css=read("styles.css");
if(!/\.reportStageViewport\s*\{[^}]*overflow:auto/s.test(css)) fail("Report deck viewport is not scroll-safe");
else pass("Report deck viewport prevents content clipping");
if(!css.includes(".copyFadeOut") || !css.includes(".copyFadeIn")) fail("Coach copy cross-fade styles are missing");
else pass("Coach copy cross-fade styles exist");

const liveModule = await import(new URL("../netlify/functions/live-search.mjs", import.meta.url));
const testPerson = {
  fullName:"Andrew Hammond",
  city:"Toronto",
  username:"",
  ageContext:liveModule.buildAgeContext(50),
  searchClues:["Toronto Police","University of Western Ontario"]
};
const wrongPersonResult = liveModule.matchResult({
  title:"Ottawa Senators goaltender Andrew Hammond leads win over Toronto Maple Leafs",
  description:"Hockey coverage and player results.",
  url:"https://example.com/sports/andrew-hammond"
}, testPerson);
if(wrongPersonResult.confidence!=="discard") fail("Same-name sports collision was not rejected");
else pass("Same-name sports collision is rejected");

const rightPersonResult = liveModule.matchResult({
  title:"Andrew Hammond - Toronto Police Service",
  description:"Andrew Hammond, Toronto Police, with education at Western University in Ontario.",
  url:"https://example.com/profile/andrew-hammond"
}, testPerson);
if(rightPersonResult.confidence!=="strong") fail("Clue-supported identity match was not retained");
else pass("Clue-supported identity match is retained");

const fakeNewsHandle=liveModule.maskedHandle("https://www.espn.com/nhl/story/_/id/12345/andrew-hammond","espn.com");
if(fakeNewsHandle) fail("Non-account news URL became a fake social handle");
else pass("Non-account news URLs do not become fake handles");
const linkedInHandle=liveModule.maskedHandle("https://www.linkedin.com/in/andrew-hammond-41194","LinkedIn");
if(!linkedInHandle?.startsWith("@")) fail("LinkedIn account path did not produce a masked handle");
else pass("Recognized social account paths still produce masked handles");

const functionNames=new Set(fs.readdirSync(path.join(root,"netlify/functions"))
  .filter(n=>n.endsWith(".mjs")).map(n=>n.replace(/\.mjs$/,"")));
for(const jsPath of ["app.js","presenter.js","volunteer.js"]){
  const js=read(jsPath);
  const refs=[...js.matchAll(/\/\.netlify\/functions\/([A-Za-z0-9_-]+)/g)].map(m=>m[1]);
  const missing=[...new Set(refs.filter(name=>!functionNames.has(name)))];
  if(missing.length) fail(jsPath+" calls missing Netlify functions: "+missing.join(", "));
  else pass(jsPath+" Netlify function references resolve");
}

if(process.exitCode) process.exit(process.exitCode);
console.log("Static QA complete.");
