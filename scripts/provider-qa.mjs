import liveSearch from "../netlify/functions/live-search.mjs";

// Deterministic provider-failover smoke test. No real search credits are spent.
const oldFetch=globalThis.fetch;
const oldBrave=process.env.BRAVE_SEARCH_API_KEY;
const oldSerp=process.env.SERPAPI_API_KEY;
process.env.BRAVE_SEARCH_API_KEY="qa-no-credit";
process.env.SERPAPI_API_KEY="qa-serp-fallback";
let calls={brave:0,google:0,image:0};

function assert(name,condition){
  if(!condition)throw new Error("QA FAIL: "+name);
  console.log("QA PASS:",name);
}

globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.hostname==="api.search.brave.com"){
    calls.brave++;
    return Response.json({error:{code:"CREDIT_EXHAUSTED",detail:"Prepaid credit balance is insufficient"}},{status:402});
  }
  if(url.hostname==="serpapi.com"){
    if(url.searchParams.get("engine")==="google_images"){
      calls.image++;
      return Response.json({images_results:[]});
    }
    calls.google++;
    return Response.json({
      organic_results:[
        {title:"Alex Example, Toronto community speaker",
         snippet:"Alex Example is a Toronto community speaker and sports volunteer",
         link:"https://www.linkedin.com/in/alexexample"},
        {title:"Alex Example - community running event",
         snippet:"Toronto community sports event with Alex Example",
         link:"https://example.org/toronto/alex-example-running"}
      ]
    });
  }
  throw new Error("Unmocked external provider: "+url.hostname);
};

try{
  const request=new Request("https://qa.example/api/live-search",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({
      consent:true,firstName:"Alex",lastName:"Example",
      age:"40",city:"Toronto",username:"alexexample",clues:"community sports"
    })
  });
  const response=await liveSearch(request);
  const data=await response.json();
  assert("Brave 402 falls back instead of terminating",response.status===200);
  assert("SerpApi Google actually used",data.providersUsed?.includes("SerpApi Google"));
  assert("Google indexed strong public source survives identity checks",
    data.publicSources?.some(s=>s.url==="https://www.linkedin.com/in/alexexample" && s.confidence==="strong"));
  assert("Partial provider failure is disclosed",data.searchHealth?.partial===true);
  assert("Provider health reports Brave failure",data.providerErrors?.some(e=>/Brave:/.test(e)));
  assert("SerpApi budget is enforced",calls.google<=5);
  assert("Expired Brave token is not repeatedly retried",calls.brave<=2);
  console.log("Provider fallback QA: 7/7 passed");
}finally{
  globalThis.fetch=oldFetch;
  if(oldBrave===undefined)delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY=oldBrave;
  if(oldSerp===undefined)delete process.env.SERPAPI_API_KEY;
  else process.env.SERPAPI_API_KEY=oldSerp;
}
