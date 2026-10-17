import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync("app.js","utf8");
const native=fs.readFileSync("phone-native.js","utf8");
const style=fs.readFileSync("phone-native.css","utf8");
const start=source.indexOf("  function detailRowsHtml(detail) {");
const end=source.indexOf("  function isGuideNavigationTarget(target) {",start);
assert.ok(start>=0 && end>start,"detail renderer is present");
const fn=Function("escapeHtml",source.slice(start,end)+"\nreturn detailRowsHtml;")(
  value=>String(value||"").replace(/[&<>"']/g,ch=>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))
);
const overview=fn({kind:"iosLocationOverview"});
for (const label of [
  "Location Services","Location Alerts","Share My Location","App Clips",
  "Maps","Instagram","Location Services uses GPS","Apple Watch",
  "YOUR LIST WILL DIFFER"
]) {
  assert.ok(overview.includes(label),"iPhone overview should show: "+label);
}
assert.ok(overview.indexOf("Location Alerts")<overview.indexOf("Share My Location"));
assert.ok(overview.indexOf("Share My Location")<overview.indexOf("App Clips"));
assert.ok(overview.includes("iosLocationNextApp"),"highlight app row, not master switch");
assert.ok(!overview.includes("phoneSettingOption"),"overview must not show app's permission radio list");
const app=fn({kind:"iosAppLocation"});
for(const label of ["Never","Ask Next Time Or When I Share","While Using the App","Precise Location"]){
  assert.ok(app.includes(label),"per-app screen should show: "+label);
}
assert.ok(!app.includes("Location Alerts"),"per-app permissions are not the main overview");
assert.ok(app.includes("EXAMPLE APP"),"illustration should not claim to reflect user settings");
assert.ok(native.includes('focus=$(".iosLocationNextApp",screen)') &&
  native.includes('"iosLocationPreciseFocus"'),"native spotlight must target actual app controls");
assert.ok(style.includes(".iosLocationAppGroup")&&style.includes(".iosLocationMasterSwitch"),
 "Phone UI must style the overview and per-app controls");
assert.ok(source.includes('if(p.device==="ios" && target==="Precise Location" && previousWasDetail)'),
 "Privacy and parent guides must skip misleading return-to-menu step");
assert.ok(source.includes('["Precise Location","After you select an app from the list,'),
 "Privacy guide must accurately explain how to find Precise Location");
console.log("iPhone Location Services page/permission separation QA passed.");