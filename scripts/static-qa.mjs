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
if(!app.includes("const APP_SETTING_DETAILS = {") || !app.includes("function settingDetailFor(")) fail("App privacy detail-screen model is missing");
else pass("App privacy walkthroughs render real setting detail screens");
if(!app.includes("phoneAppIdentity") || !app.includes("coachAppBadge")) fail("Persistent app branding is missing from walkthroughs");
else pass("Walkthroughs keep app identity and branding visible");
if(!app.includes('target==="Notifications"') || !app.includes("phoneNotificationSettings")) fail("Universal notification privacy screen is missing");
else pass("Every app guide includes a notification privacy screen");
if(!app.includes('detail.kind === "location"')) fail("Location permission detail screen is missing");
else pass("Location permission choices render inside the phone");
if(!app.includes("APP DEFAULT SETTING") || !app.includes("RECOMMENDED PRIVACY SETTING") || !app.includes("function appDefaultSettingFor(")) fail("Default/recommended privacy comparison is missing");
else pass("App default and recommended privacy tiles render");
if(!app.includes('.filter(step=>step[2]!=="EXPLAIN")')) fail("Social app guides still include redundant explanation slides");
else pass("Social app guides remove redundant explanation slides");
if(!app.includes("function settingTeachingExpansion(")) fail("Setting-level teaching point expansion is missing");
else pass("Setting screen carries the full why-it-matters teaching point");
if(!app.includes("function platformHeaderFor(")) fail("Social privacy walkthrough header renderer is missing");
else pass("Social privacy walkthrough header renderer exists");
if(!app.includes("phoneSceneNativeIncoming")) fail("Native-style phone screen transition is missing");
else pass("Native-style phone screen transition exists");

const css=read("styles.css");
if(!/\.reportStageViewport\s*\{[^}]*overflow:auto/s.test(css)) fail("Report deck viewport is not scroll-safe");
else pass("Report deck viewport prevents content clipping");
if(!css.includes(".copyFadeOut") || !css.includes(".copyFadeIn")) fail("Coach copy cross-fade styles are missing");
else pass("Coach copy cross-fade styles exist");

const photoCss=read("photo-demo.css");
if(!/body\.photoPresentationMode \.revealSlide\s*\{[^}]*overflow-y:auto/s.test(photoCss)) fail("Presenter reveal slides still clip tall content");
else pass("Presenter reveal slides scroll instead of clipping");
if(!/\.impactSlide \.photoRevealControls\s*\{[^}]*position:sticky/s.test(photoCss)) fail("Impact controls can still overlay voice content");
else pass("Impact controls reserve their own space");
if(!photoCss.includes(".correlationDisclosure{") || !photoCss.includes("z-index:8")) fail("Breadcrumb disclosure separation is missing");
else pass("Breadcrumb disclosure is separated from graph nodes");
if(!presenter.includes("active.scrollTop=0")) fail("Presenter slide scroll reset is missing");
else pass("Presenter slide scroll resets on navigation");

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

const psychotherapistCollision=liveModule.matchResult({
  title:"Andrew Hammond, Registered Psychotherapist (Qualifying)",
  description:"Spencerville, Ontario. Clinical counselling practice. Former military, paramedic and police officer. Masters of Divinity.",
  url:"https://www.psychologytoday.com/ca/therapists/andrew-hammond-spencerville-on/1828152"
}, testPerson);
if(psychotherapistCollision.confidence!=="discard") fail("Psychotherapist same-name profile was not rejected");
else pass("Psychotherapist same-name profile is rejected");

if(!read("netlify/functions/live-search.mjs").includes(".filter(([,count])=>count >= 2)")) fail("Recurring themes can still be created from a single source");
else pass("Recurring themes require repetition across multiple eligible sources");

if(presenter.includes("speechSynthesis") || presenter.includes("SpeechSynthesisUtterance")) fail("Presenter still uses robotic browser speech synthesis");
else pass("Presenter no longer uses browser speech synthesis");
if(!presenter.includes("photo-generated-voice")) fail("Presenter natural AI voice endpoint is missing");
else pass("Presenter uses server-generated natural AI speech");

const lisaPerson={
  fullName:"Lisa Butcher",
  city:"Kelowna",
  username:"",
  ageContext:null,
  searchClues:["Therapist"]
};
const lisaWrong=liveModule.matchResult({
  title:"Lisa Butcher - Therapist",
  description:"Therapist based in the United Kingdom.",
  url:"https://www.facebook.com/lisabutcherukofficial"
},lisaPerson);
if(lisaWrong.confidence!=="discard") fail("Kelowna Lisa Butcher collision was not rejected");
else pass("Kelowna Lisa Butcher collision is rejected");

const lisaRight=liveModule.matchResult({
  title:"Lisa Butcher | Counselling BC",
  description:"Registered Clinical Counsellor. Primary location Kelowna, BC. Private counselling practice.",
  url:"https://counsellingbc.com/listings/lbutcher.htm"
},lisaPerson);
if(lisaRight.confidence!=="strong") fail("Kelowna counsellor synonym match was not retained");
else pass("Kelowna counsellor synonym match is retained");

if(!read("netlify/functions/live-search.mjs").includes("Verified account expansion")) fail("Verified social-account expansion is missing");
else pass("Verified social accounts can expand into indexed posts and photos");

if(!presenter.includes("finishPhotoReveal()")) fail("Photo presenter Done handler is missing");
else pass("Photo presenter Done returns to the session screen");

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
