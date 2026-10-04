import liveSearch from "../netlify/functions/live-search.mjs";
import summarize from "../netlify/functions/summarize.mjs";

const tests=[];
const test=(name,pass,detail="")=>{
  tests.push({name,pass,detail});
  if(!pass) console.error("QA FAIL:",name,detail);
  else console.log("QA PASS:",name);
};

const originalFetch=globalThis.fetch;
const originalKey=process.env.BRAVE_SEARCH_API_KEY;
process.env.BRAVE_SEARCH_API_KEY="qa-test-key";

const braveThumb="https://imgs.search.brave.com/test-proxy-image.jpg";

globalThis.fetch=async (input,init={})=>{
  const url=String(input);
  if(url.includes("/images/search")){
    return Response.json({
      results:[
        {
          title:"Alex Example public event photo Toronto",
          url:"https://example.org/gallery/alex-example",
          source:"example.org",
          thumbnail:{src:braveThumb}
        },
        {
          title:"Unrelated person",
          url:"https://example.net/unrelated",
          source:"example.net",
          thumbnail:{src:"https://imgs.search.brave.com/unrelated.jpg"}
        }
      ]
    });
  }

  const body=init.body ? JSON.parse(init.body) : {};
  const q=String(body.q||"");
  if(q.includes("NoResultsPerson")){
    return Response.json({web:{results:[]}});
  }

  return Response.json({
    web:{
      results:[
        {
          title:"Alex Example - Toronto community profile",
          description:"Alex Example joined a Toronto community event. Contact alex.example@example.com or 416-555-1202 at 123 Main Street.",
          url:"https://www.linkedin.com/in/alexexample",
          thumbnail:{src:braveThumb}
        },
        {
          title:"Alex Example travel discussion",
          description:"Talking about travel, community events and local sports.",
          url:"https://www.reddit.com/user/alexexample"
        },
        {
          title:"University event only",
          description:"Toronto community event without the searched person name.",
          url:"https://example.org/event-only"
        }
      ]
    }
  });
};

async function call(handler,path,body){
  return handler(new Request("https://qa.local"+path,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body)
  }));
}

try{
  const response=await call(liveSearch,"/api/live-search",{
    consent:true,
    firstName:"Alex",
    lastName:"Example",
    age:"40",
    city:"Toronto",
    username:"alexexample",
    clues:"community, sports"
  });
  const data=await response.json();

  test("live search returns 200",response.status===200,response.status);
  test("live mode is public",data.dataMode==="verified",data.dataMode);
  test("provider is Brave",data.provider==="Brave Search API",data.provider);
  test("strong matches are returned",data.publicSources.some(x=>x.confidence==="strong"),data.publicSources);
  test("clue-only false match is discarded",!data.publicSources.some(x=>x.url.includes("event-only")),data.publicSources);
  test("raw email is not exposed",!JSON.stringify(data).includes("alex.example@example.com"));
  test("raw phone is not exposed",!JSON.stringify(data).includes("416-555-1202"));
  test("raw street is not exposed",!JSON.stringify(data).includes("123 Main Street"));
  test("masked email is surfaced",JSON.stringify(data).includes("al•••••@e•••.com"),data.findings);
  test("masked phone is surfaced",JSON.stringify(data).includes("416-xxx-xx02"),data.findings);
  test("presentation quotes exist",Array.isArray(data.presentation?.quotes)&&data.presentation.quotes.length>0,data.presentation);
  test("presentation themes exist",Array.isArray(data.presentation?.themes)&&data.presentation.themes.length>0,data.presentation);
  test("blur-safe Brave thumbnail payload exists",data.presentation?.photos?.some(x=>x.src===braveThumb),data.presentation?.photos);
  test("image disclaimer rejects face verification",/not verified by facial recognition/i.test(data.presentation?.disclaimer||""),data.presentation?.disclaimer);
  test("age remains soft signal",/soft supporting signal/i.test(data.ageMatching?.note||""),data.ageMatching);

  const zeroRes=await call(liveSearch,"/api/live-search",{
    consent:true,firstName:"NoResultsPerson",lastName:"Example",age:"35",city:"",username:"",clues:""
  });
  const zero=await zeroRes.json();
  test("zero-result live search still succeeds",zeroRes.status===200,zeroRes.status);
  test("zero-result publicSources is empty",Array.isArray(zero.publicSources)&&zero.publicSources.length===0,zero.publicSources);

  const minorRes=await call(liveSearch,"/api/live-search",{
    consent:true,firstName:"Minor",lastName:"Example",age:"17",city:"Toronto"
  });
  test("minor live person search is blocked",minorRes.status===400,minorRes.status);

  const noConsentRes=await call(liveSearch,"/api/live-search",{
    consent:false,firstName:"Alex",lastName:"Example",age:"40"
  });
  test("live search requires consent",noConsentRes.status===400,noConsentRes.status);

  const evidence={
    subject:{displayName:"Evidence Test"},
    findings:{
      addresses:["123 Main Street"],
      education:[{school:"Test University"}],
      employment:[{employer:"Example"}],
      socialProfiles:[{platform:"Instagram",handle:"@exampleuser"}],
      contacts:[
        {type:"email",value:"alex.example@example.com"},
        {type:"phone",value:"416-555-1202"}
      ],
      images:Array.from({length:5},()=>({})),
      publicContent:Array.from({length:4},()=>({})),
      locationSignals:[],
      timeline:[{year:2020},{year:2026}]
    }
  };
  const sumRes=await call(summarize,"/.netlify/functions/summarize",{consent:true,evidence});
  const sum=await sumRes.json();
  test("evidence summarizer returns 200",sumRes.status===200,sumRes.status);
  test("evidence mode is explicit",sum.dataMode==="evidence",sum.dataMode);
  test("evidence email remains masked",!JSON.stringify(sum).includes("alex.example@example.com"),sum.findings);
  test("evidence phone remains masked",!JSON.stringify(sum).includes("416-555-1202"),sum.findings);
  test("evidence address remains masked",!JSON.stringify(sum).includes("123 Main Street"),sum.findings);

} finally {
  globalThis.fetch=originalFetch;
  if(originalKey===undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY=originalKey;
}

const failed=tests.filter(t=>!t.pass);
console.log("\nRuntime QA:",tests.length-failed.length+"/"+tests.length,"passed");
if(failed.length) process.exit(1);
