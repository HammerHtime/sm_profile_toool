// Public-person benchmark for the demo app. Results are diagnostic, not proof of completeness.
// Every reference account below is a publicly established account of a prominent public figure.
import {writeFileSync} from "node:fs";
const SITE=process.env.SITE_URL||"https://sm-profile-tool.netlify.app";
const subjects=[
  {id:"A",input:{firstName:"Gordon",lastName:"Ramsay",age:"59",city:"London",clues:"chef television"},
   anchors:[["Instagram","instagram.com","gordongram"],["TikTok","tiktok.com","gordonramsayofficial"],["YouTube","youtube.com","gordonramsay"],["X","x.com","gordonramsay"],["Facebook","facebook.com","gordonramsay"]]},
  {id:"B",input:{firstName:"Cristiano",lastName:"Ronaldo",age:"41",city:"Riyadh",clues:"football athlete"},
   anchors:[["Instagram","instagram.com","cristiano"],["YouTube","youtube.com","cristiano"],["X","x.com","cristiano"],["Facebook","facebook.com","cristiano"]]},
  {id:"C",input:{firstName:"Ryan",lastName:"Reynolds",age:"49",city:"Vancouver",clues:"actor producer"},
   anchors:[["Instagram","instagram.com","vancityreynolds"],["X","x.com","vancityreynolds"],["Facebook","facebook.com","vancityreynolds"]]}
];
const results=[];
function hasExpected(sources,host,handle) {
  const target=handle.toLowerCase();
  for(const s of sources) {
    try {
      const u=new URL(s.url);
      const hostname=u.hostname.replace(/^www\.|^m\./g,"").toLowerCase();
      if(!(hostname===host || hostname.endsWith("."+host)))continue;
      const path=u.pathname.split("/").filter(Boolean).map(x=>x.toLowerCase());
      if(host==="youtube.com") {
        if(path[0]==="@"+target || (path[0]==="user"&&path[1]===target))return true;
      }else if(host==="x.com"){
        if(path[0]===target)return true;
      }else if(path[0]===target || (host==="facebook.com" && path[0]==="people"&&path[1]?.includes(target))) return true;
    }catch{}
  }
  return false;
}
for(const subject of subjects){
  const started=Date.now();
  let record={test:subject.id,success:false,referenceAccounts:subject.anchors.length};
  try{
    const resp=await fetch(SITE+"/api/live-search",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...subject.input,consent:true,username:""}),
      signal:AbortSignal.timeout(110000)
    });
    const data=await resp.json().catch(()=>({}));
    record.httpStatus=resp.status;
    if(!resp.ok)throw new Error([data.error,data.detail,...(data.providerErrors||[])].filter(Boolean).join(" | ").slice(0,600));
    const sources=Array.isArray(data.publicSources)?data.publicSources:[];
    const matches=subject.anchors.map(([platform,host,handle])=>({
      platform,found:hasExpected(sources,host,handle)
    }));
    const good=matches.filter(x=>x.found).length;
    const sourcePlatforms=[...new Set(sources.map(x=>x.platform).filter(Boolean))];
    record={...record,success:true,provider:data.provider,searchPasses:data.searchHealth?.completed??null,
      incompleteSearch:!!(data.searchHealth?.partial||data.searchHealth?.failed),
      publicSourceCount:sources.length,
      strongCount:sources.filter(x=>x.confidence==="strong").length,
      possibleCount:sources.filter(x=>x.confidence==="possible").length,
      socialPlatformCount:sourcePlatforms.filter(x=>["Instagram","TikTok","YouTube","X / Twitter","Facebook","LinkedIn","Threads","Reddit"].includes(x)).length,
      observedPlatformTypes:sourcePlatforms,
      foundReferenceAccounts:good,
      referenceAccountRecall:Math.round(good*100/subject.anchors.length),
      matched:matches.filter(x=>x.found).map(x=>x.platform),
      missing:matches.filter(x=>!x.found).map(x=>x.platform),
      timelineItems:(data.intelligence?.timeline||[]).length,
      providerErrors:data.providerErrors||[]
    };
  }catch(error){
    record.error=String(error?.message||error).slice(0,400);
  }
  record.durationSeconds=Math.round((Date.now()-started)/1000);
  results.push(record);
  console.log("BENCHMARK "+JSON.stringify(record));
}
const summary={
 tested:results.length,
 usableResults:results.filter(x=>x.success).length,
 knownAccountRecallPct:Math.round(
   results.reduce((sum,x)=>sum+(x.foundReferenceAccounts||0),0)*100/
   results.reduce((sum,x)=>sum+x.referenceAccounts,0)
 ),
 note:"Account recall measures known public profile URLs only. Source accuracy, full public-web coverage and timeline factual precision require independent manual review.",
 results
};
writeFileSync("public-profile-benchmark-results.json",JSON.stringify(summary,null,2));
console.log("BENCHMARK_SUMMARY "+JSON.stringify({tested:summary.tested,usableResults:summary.usableResults,knownAccountRecallPct:summary.knownAccountRecallPct}));
if(summary.usableResults<3)process.exitCode=1;