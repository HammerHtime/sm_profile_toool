import "../guide-paths.js";

const {resolve}=globalThis.GuidePaths||{};
if(typeof resolve!=="function")throw new Error("GuidePaths resolver is unavailable");
let checks=0;
function equal(name,actual,expected){
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw new Error(name+" expected "+JSON.stringify(expected)+" but got "+JSON.stringify(actual));
  checks++;
  console.log("PATH PASS:",name);
}
function route(platform,device,parent,title,target,steps=null,index=0){
  const list=steps||[[title,target,target]];
  return resolve({platform,device,parent,steps:list,index});
}
equal("iPhone contacts from Settings",
  route("iPhone Privacy","ios",false,"Contacts","Contacts").path,
  ["Settings","Privacy & Security","Contacts"]);
equal("iPhone precise location follows app selection",
  route("iPhone Privacy","ios",false,"Precise Location","Precise Location").path,
  ["Settings","Privacy & Security","Location Services","Choose an app","Precise Location"]);
equal("iPhone initial Settings root",
  route("iPhone Privacy","ios",false,"Open Settings","Settings").path,
  ["Settings"]);
equal("Child Screen Time branch",
  route("iPhone / iPad","ios",true,"Choose your child","Child").path,
  ["Settings","Screen Time","Child"]);
const iosFamilySteps=[
  ["Open Settings","","Settings"],["Choose your child","","Child"],
  ["Open Family","","Family"],["Select child","","Child"],["Ask to Buy","","Ask to Buy"]
];
equal("Family branch does not inherit Screen Time",
  route("iPhone / iPad","ios",true,"Select child","Child",iosFamilySteps,3).path,
  ["Settings","Family","Child"]);
equal("Family Ask to Buy child controls",
  route("iPhone / iPad","ios",true,"Ask to Buy","Ask to Buy",iosFamilySteps,4).path,
  ["Settings","Family","Child","Ask to Buy"]);
equal("Child iPhone privacy branch",
  route("iPhone / iPad","ios",true,"Contacts","Contacts").path,
  ["Child's iPhone","Settings","Privacy & Security","Contacts"]);
equal("iPhone Screen Time content controls",
  route("iPhone / iPad","ios",true,"App Store","App Store, Media, Web & Games").path,
  ["Settings","Screen Time","Child","Content & Privacy Restrictions","App Store, Media, Web & Games"]);
equal("Android permission manager entry",
  route("Android Privacy","android",false,"Permission manager","Privacy controls").path,
  ["Settings","Security & privacy","Privacy","Permission manager"]);
equal("Android choose app before precise location",
  route("Android Privacy","android",false,"Precise location","Precise location").path,
  ["Settings","Security & privacy","Privacy","Permission manager","Location","Choose an app","Use precise location"]);
equal("Android Family Link child daily limit",
  route("Android / Family Link","android",true,"Daily limit","Daily limit").path,
  ["Family Link","Child","Screen time","Time limits","Daily limit"]);
equal("Android Google Play approvals",
  route("Android / Family Link","android",true,"App approvals","App approvals").path,
  ["Family Link","Child","Controls","Google Play","Purchase & download approvals","App approvals"]);
equal("Instagram opening profile",
  route("Instagram","",false,"Open Instagram","Profile").path,
  ["Instagram","Profile"]);
equal("Instagram private account",
  route("Instagram","",false,"Turn on Private account","Private account").path,
  ["Instagram","Profile","Menu","Settings and activity","Account privacy","Private account"]);
equal("Instagram parent Family Center",
  route("Instagram","",true,"Invite teen","Supervision").path,
  ["Instagram","Profile","Menu","Settings and activity","Family Center","Supervision"]);
equal("Facebook future post audience",
  route("Facebook","",false,"Future posts","Future posts").path,
  ["Facebook","Menu","Settings & privacy","Privacy Checkup","Who can see what you share","Future posts"]);
equal("TikTok private account",
  route("TikTok","",false,"Private account","Private account").path,
  ["TikTok","Profile","Menu","Settings and privacy","Privacy","Private account"]);
equal("LinkedIn phone discoverability",
  route("LinkedIn","",false,"Phone discovery","Phone discovery").path,
  ["LinkedIn","Profile","Settings","Visibility","Profile discovery using phone"]);
equal("Snapchat Map shortcut",
  route("Snapchat","",false,"Snap Map","Snap Map").path,
  ["Snapchat","Snap Map","Ghost Mode"]);
equal("Strava map visibility",
  route("Strava","",false,"Map visibility","Map Visibility").path,
  ["Strava","Settings","Privacy Controls","Map Visibility"]);
const explainSteps=[
  ["Tap Private account","","NAV:Private account"],
  ["Turn on Private account","","Private account"],
  ["Why it matters","","EXPLAIN"]
];
equal("Why-it-matters retains previous route",
  route("Instagram","",false,"Why it matters","EXPLAIN",explainSteps,2).path,
  ["Instagram","Profile","Menu","Settings and activity","Account privacy","Private account"]);
const notification=route("Instagram","",false,"Notification privacy","Notifications");
equal("Phone-level notification path",notification.path,
  ["iPhone Settings","Notifications","Instagram"]);
equal("Phone-level Android alternative",notification.alternative,
  ["Android Settings","Apps","Instagram","Notifications"]);
const location=route("Facebook","",false,"Review location","Location");
equal("Phone-level location iOS path",location.path,
  ["iPhone Settings","Apps","Facebook","Location"]);
equal("Phone-level location Android alternative",location.alternative,
  ["Android Settings","Apps","Facebook","Permissions","Location"]);
for(const platform of [
  "Instagram","Facebook","TikTok","LinkedIn","Reddit","X / Twitter",
  "Snapchat","Discord","YouTube","WhatsApp","Telegram",
  "Twitch","GitHub","Pinterest","Strava"
]){
  const result=route(platform,"",false,"Open Settings","Settings");
  if(result.path.length<2)throw new Error(platform+" lacks root path");
  checks++;
}
console.log("Guide breadcrumb QA completed: "+checks+" checks passed.");