/* High-fidelity phone walkthrough presentation layer.
   These are guided screen recreations, not captures of a user's account. */
(() => {
  "use strict";
  const $ = (s,root=document) => root.querySelector(s);
  const all = (s,root=document) => [...root.querySelectorAll(s)];
  const modal=$("#coachModal");
  const slide=$("#coachSlide");
  if (!modal || !slide) return;

  const skinList=[
    ["iPhone","ios"],["Android","android"],["Instagram","instagram"],
    ["Facebook","facebook"],["TikTok","tiktok"],["LinkedIn","linkedin"],
    ["Snapchat","snapchat"],["Discord","discord"],["YouTube","youtube"],
    ["Reddit","reddit"],["X / Twitter","twitter"],["WhatsApp","whatsapp"],
    ["Telegram","telegram"],["GitHub","github"],["Strava","strava"],
    ["Pinterest","pinterest"],["Twitch","twitch"]
  ];
  const dark=new Set(["tiktok","discord","twitter","twitch"]);
  const colors={ios:"#0a84ff",android:"#4263cb",instagram:"#d62976",
    facebook:"#1877f2",tiktok:"#25f4ee",linkedin:"#0a66c2",
    snapchat:"#ffdf00",discord:"#5865f2",youtube:"#ff0033",
    reddit:"#ff4500",twitter:"#c7d2da",whatsapp:"#18bb72",
    telegram:"#32a9e1",github:"#24292f",strava:"#fc4c02",
    pinterest:"#e60023",twitch:"#9146ff"};
  const symbols={ios:"⚙",android:"G",instagram:"◎",facebook:"f",
    tiktok:"♪",linkedin:"in",snapchat:"◉",discord:"◈",
    youtube:"▶",reddit:"●",twitter:"𝕏",whatsapp:"☎",
    telegram:"➤",github:"{ }",strava:"▲",pinterest:"P",twitch:"♜"};
  const names={ios:"Settings",android:"Settings",instagram:"Instagram",
    facebook:"Facebook",tiktok:"TikTok",linkedin:"LinkedIn",
    snapchat:"Snapchat",discord:"Discord",youtube:"YouTube",
    reddit:"Reddit",twitter:"X",whatsapp:"WhatsApp",
    telegram:"Telegram",github:"GitHub",strava:"Strava",
    pinterest:"Pinterest",twitch:"Twitch"};

  function glyph(label){
    const s=String(label||"").toLowerCase();
    const tests=[
      [/screen time|time limits|daily limit|downtime|schedule/,"◷"],
      [/location|map|precise|nearby/,"⌖"],
      [/camera|photo|image|media|gallery/,"▣"],
      [/microphone|audio|voice/,"♩"],
      [/privacy|audience|visibility|private|protect|public/,"♙"],
      [/message|chat|dm|communication|comment/,"◫"],
      [/contacts|friend|followers|connections|family|child/,"♧"],
      [/tracking|search|discovery|discover|suggest/,"⌕"],
      [/notification|alert/,"♧"],
      [/purchase|store|app|download|install/,"▦"],
      [/safety|security|lock|blocked|restrict/,"◇"],
      [/web|browser|chrome|youtube|website/,"◎"],
      [/profile|account|identity/,"●"],
      [/settings|general|controls/,"⚙"]
    ];
    return (tests.find(([re])=>re.test(s))||[null,"◦"])[1];
  }

  function skinFromTitle(value){
    const entry=skinList.find(([prefix])=>String(value).startsWith(prefix));
    return entry ? entry[1] : "ios";
  }

  function statusBar(mock,skin){
    const status=$(".phoneStatus",mock);
    if (status && !status.dataset.nativeStatus){
      status.dataset.nativeStatus="1";
      status.innerHTML='<span class="nativeClock">9:41</span><span class="nativeSignals"><span class="nativeSignal">▂▄▆</span><span class="nativeWifi">◕</span><span class="nativeBattery"><i></i></span></span>';
    }
    if (!$(".nativeGestureBar",mock)){
      const gesture=document.createElement("span");
      gesture.className="nativeGestureBar";
      mock.appendChild(gesture);
    }
    mock.style.setProperty("--native-brand",colors[skin]||"#0a84ff");
  }

  function nativeTopBar(screen,skin){
    if ($(".nativeTopBar",screen)) return;
    const header=$(".phoneTitle",screen);
    const detail=$(".phoneDetailHeader",screen);
    const isDetail=!!detail;
    const titleText=(isDetail ? ($("strong",detail)?.textContent || "Privacy settings") :
      (header?.lastElementChild?.textContent || "Settings")).trim();
    const title=titleText.replace(/^Tap\s+/i,"");
    const el=document.createElement("div");
    el.className="nativeTopBar"+(isDetail?" nativeTopBarDetail":"");
    el.innerHTML=
      '<span class="nativeBack" aria-hidden="true">‹</span>'+
      '<span class="nativeTopHeading">'+
        '<span class="nativeAppMark" aria-hidden="true">'+(symbols[skin]||"⚙")+'</span>'+
        '<span class="nativeHeadingLabel"></span>'+
      '</span>'+
      '<span class="nativeMore" aria-hidden="true">•••</span>';
    $(".nativeHeadingLabel",el).textContent=title || names[skin] || "Settings";
    screen.prepend(el);
    if (isDetail){
      // Move the current control's name into the app navigation hierarchy;
      // preserve actual settings options below.
      detail.classList.add("nativeDetailSubtitle");
    }
  }

  function addRowIcons(screen,skin){
    for(const row of all(".phoneRow",screen)){
      if ($(".nativeRowSymbol",row)) continue;
      const label=$("span",row)?.textContent || "";
      const symbol=document.createElement("span");
      symbol.className="nativeRowSymbol";
      symbol.setAttribute("aria-hidden","true");
      symbol.textContent=glyph(label);
      row.prepend(symbol);
      if (row.classList.contains("target")){
        row.setAttribute("role","button");
        row.setAttribute("tabindex","0");
        row.setAttribute("aria-label","Tap "+label+" to advance the guide");
      }
    }
    for(const row of all(".phoneSettingMenuRow",screen)){
      if ($(".nativeRowSymbol",row)) continue;
      const label=$("strong",row)?.textContent || "";
      const symbol=document.createElement("span");
      symbol.className="nativeRowSymbol";
      symbol.setAttribute("aria-hidden","true");
      symbol.textContent=glyph(label);
      row.prepend(symbol);
    }
  }

  function spotlight(screen,skin){
    let focus=$(".phoneRow.target",screen);
    if(!focus){
      focus=$(".phoneSettingOption.selected",screen) ||
        all(".phoneSettingToggleRow",screen).find(x=>/Off|On|Private account/i.test(x.textContent)) ||
        $(".phoneSettingMenuRow.emphasized",screen) ||
        $(".phoneSettingOption",screen) ||
        $(".phoneSettingToggleRow",screen) ||
        $(".phoneSettingMenuRow",screen) ||
        $(".phoneStatusSettingPrimary",screen);
    }
    if(focus){
      focus.classList.add("nativeFocus");
      if(!$(".nativeTapPin",focus)){
        const number=($("#coachCounter")?.textContent||"1").split("/")[0].trim()||"1";
        const pin=document.createElement("span");
        pin.className="nativeTapPin";
        pin.textContent=number;
        pin.setAttribute("aria-hidden","true");
        focus.appendChild(pin);
      }
      const rows=$(".phoneRows",screen);
      if(rows && rows.scrollHeight > rows.clientHeight){
        requestAnimationFrame(()=>{
          rows.scrollTop=Math.max(0,focus.offsetTop-rows.offsetTop-70);
        });
      }
    }
    return focus;
  }

  function nativeBottom(screen,skin){
    if($(".nativeBottom",screen)) return;
    const isDevice=skin==="ios"||skin==="android";
    const isDetail=!!$(".phoneDetailScreen",screen.parentElement) || screen.classList.contains("phoneDetailScreen");
    if(isDevice){
      const help=document.createElement("div");
      help.className="nativeDeviceNote";
      help.textContent=skin==="ios" ? "Settings" : "Settings • Family Link";
      screen.appendChild(help);
      return;
    }
    if(isDetail) return;
    const menus = {
      instagram:["⌂","⌕","＋","▣","◉"],
      facebook:["⌂","◉","▣","♧","☰"],
      tiktok:["⌂","⌕","＋","▤","●"],
      linkedin:["⌂","♧","＋","▤","◉"],
      youtube:["⌂","◫","＋","▶","●"],
      snapchat:["⌖","◉","●","◎","♧"],
      discord:["◉","⌕","♧","▤","●"],
      reddit:["⌂","▤","＋","◉","●"],
      twitter:["⌂","⌕","◎","▤","●"]
    };
    const icons=menus[skin]||["⌂","⌕","＋","♧","●"];
    const nav=document.createElement("div");
    nav.className="nativeBottom";
    nav.setAttribute("aria-hidden","true");
    nav.innerHTML=icons.map((g,i)=>'<span'+(i===0?' class="active"':'')+'>'+g+'</span>').join("");
    screen.appendChild(nav);
  }

  function createFootnote(screen,skin){
    if($(".nativeScreenLabel",screen))return;
    const label=document.createElement("div");
    label.className="nativeScreenLabel";
    label.textContent=(skin==="ios"?"iPhone":skin==="android"?"Android":names[skin])+" · illustrative settings view";
    screen.appendChild(label);
  }

  function enhanceScene(scene,skin){
    if(scene.dataset.nativeEnhanced==="1")return;
    scene.dataset.nativeEnhanced="1";
    const screen=$(".phoneScreen",scene);
    if(!screen)return;
    screen.classList.add("nativeScreen","native-"+skin);
    nativeTopBar(screen,skin);
    addRowIcons(screen,skin);
    spotlight(screen,skin);
    nativeBottom(screen,skin);
    createFootnote(screen,skin);
  }

  function refresh(){
    if(modal.classList.contains("hidden"))return;
    const brand=$("#coachBrand")?.textContent||"";
    const skin=skinFromTitle(brand);
    modal.dataset.nativeSkin=skin;
    const mock=$(".phoneMock",slide);
    if(mock) statusBar(mock,skin);
    all(".phoneScene",slide).forEach(scene=>enhanceScene(scene,skin));
    // A legible on-stage reminder, visible even when the phone is small.
    const copy=$(".coachCopy",slide);
    if(copy && !$(".nativeGuideHint",copy)){
      const hint=document.createElement("div");
      hint.className="nativeGuideHint";
      hint.innerHTML='<strong>ON THE PHONE</strong><span>Follow the numbered highlight. Click the highlighted control or press → to continue.</span><small>Guided screen recreation. Labels may vary by app/device version. Use Official help for current instructions.</small>';
      copy.appendChild(hint);
    }
  }

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;refresh();});
  });
  observer.observe(slide,{subtree:true,childList:true});
  observer.observe(modal,{attributes:true,attributeFilter:["class"]});

  slide.addEventListener("click",(event)=>{
    const focus=event.target.closest(".nativeFocus");
    if(!focus||!$(".phoneDetailScreen",slide))return;
    if(focus.matches(".phoneRow.target"))return;
    $("#coachNext")?.click();
  });
  slide.addEventListener("keydown",(event)=>{
    if(event.key!=="Enter"&&event.key!==" ")return;
    if(event.target.matches(".phoneRow.target")){
      event.preventDefault();
      $("#coachNext")?.click();
    }
  });
  refresh();
})();