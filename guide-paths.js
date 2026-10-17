/* Presenter breadcrumb routes, keyed to the destination of each guide step.
   UI representations and menu names are instructional. Routes can change
   with platform version, account age, device maker and region. */
(() => {
  "use strict";
  const root = {
    Instagram:["Instagram","Profile","Menu","Settings and activity"],
    Facebook:["Facebook","Menu","Settings & privacy"],
    TikTok:["TikTok","Profile","Menu","Settings and privacy"],
    LinkedIn:["LinkedIn","Profile","Settings"],
    Reddit:["Reddit","Profile menu","Settings"],
    "X / Twitter":["X","Profile menu","Settings and privacy"],
    Snapchat:["Snapchat","Profile","Settings"],
    Discord:["Discord","User Settings"],
    YouTube:["YouTube","Profile","Settings"],
    WhatsApp:["WhatsApp","Settings"],
    Telegram:["Telegram","Settings"],
    Twitch:["Twitch","Profile","Settings"],
    GitHub:["GitHub","Profile","Settings"],
    Pinterest:["Pinterest","Profile","Settings"],
    Strava:["Strava","Settings"]
  };
  // Values below are the additional screens after each application's root.
  // A value of [] means the root menu itself. Routes for platform shortcuts
  // use the shortest honest path rather than inventing unrelated screens.
  const branches = {
    Instagram:{
      "Account privacy":["Account privacy"],
      "Private account":["Account privacy","Private account"],
      "Tags and mentions":["Tags and mentions"],
      "Tags / Mentions":["Tags and mentions","Tags and mentions controls"],
      "Messages and story replies":["Messages and story replies"],
      "Message controls":["Messages and story replies","Message controls"],
      "Contact syncing":["Contact syncing"]
    },
    Facebook:{
      "Privacy Checkup":["Privacy Checkup"],
      "Audience":["Privacy Checkup","Who can see what you share"],
      "Future posts":["Privacy Checkup","Who can see what you share","Future posts"],
      "How people find you":["Privacy Checkup","How people can find you"],
      "Search engines":["Settings","Audience and visibility","How people find and contact you","Search engine links"]
    },
    TikTok:{
      "Privacy":["Privacy"],
      "Private account":["Privacy","Private account"],
      "Suggest account":["Privacy","Suggest your account to others"],
      "Sync contacts":["Privacy","Sync contacts and Facebook friends"],
      "Downloads":["Privacy","Downloads"],
      "Direct messages":["Privacy","Direct messages"]
    },
    LinkedIn:{
      "Visibility":["Visibility"],
      "Public profile":["Visibility","Edit your public profile"],
      "Public profile visibility":["Visibility","Edit your public profile","Public visibility"],
      "Email discovery":["Visibility","Profile discovery using email"],
      "Phone discovery":["Visibility","Profile discovery using phone"],
      "Email visibility":["Visibility","Who can see your email address"]
    },
    Reddit:{
      "Privacy":["Privacy"],
      "Chat requests":["Account settings","Chat and messaging","Chat requests"],
      "Followers":["Profile settings","Followers"],
      "Personalization":["Account settings","Personalization"],
      "Public activity":["Profile","Posts and comments"]
    },
    "X / Twitter":{
      "Privacy and safety":["Privacy and safety"],
      "Audience / tagging":["Privacy and safety","Audience, media and tagging"],
      "Protect posts":["Privacy and safety","Audience, media and tagging","Protect your posts"],
      "Discoverability":["Privacy and safety","Discoverability and contacts"],
      "Discovery":["Privacy and safety","Discoverability and contacts"],
      "Location":["Privacy and safety","Location information"]
    },
    Snapchat:{
      "Contact Me":["Privacy controls","Contact Me"],
      "Story audience":["Privacy controls","View My Story"],
      "Quick Add":["Privacy controls","See Me in Find Friends"],
      "Snap Map":["Snap Map","Ghost Mode"]
    },
    Discord:{
      "Content & Social":["Content & Social"],
      "Server DMs":["Content & Social","Direct messages from server members"],
      "Message requests":["Content & Social","Message requests"],
      "Friend requests":["Content & Social","Friend requests"],
      "Activity privacy":["Activity Privacy"]
    },
    YouTube:{
      "Privacy":["Privacy"],
      "Subscriptions":["Privacy","Keep all subscriptions private"],
      "Playlists":["You","Playlists","Playlist visibility"],
      "History":["Manage all history"],
      "Comments":["History","Comments"]
    },
    WhatsApp:{
      "Privacy":["Privacy"],
      "Last seen":["Privacy","Last seen and online"],
      "Profile photo":["Privacy","Profile photo"],
      "About / Status":["Privacy","About / Status"],
      "Groups":["Privacy","Groups"],
      "Live location":["Privacy","Live location"]
    },
    Telegram:{
      "Privacy and Security":["Privacy and Security"],
      "Phone Number":["Privacy and Security","Phone Number"],
      "Last seen":["Privacy and Security","Last Seen & Online"],
      "Forwarded messages":["Privacy and Security","Forwarded Messages"],
      "Groups & Channels":["Privacy and Security","Groups & Channels"],
      "People Nearby":["People Nearby"]
    },
    Twitch:{
      "Security and Privacy":["Security and Privacy"],
      "Blocked users":["Security and Privacy","Blocked users"],
      "Whispers":["Security and Privacy","Whispers"],
      "Activity":["Security and Privacy","Activity sharing"],
      "Connections":["Connections"]
    },
    GitHub:{
      "Public profile":["Public profile"],
      "Public email":["Public profile","Public email"],
      "Email privacy":["Emails"],
      "Public repositories":["Your repositories","Public repositories"],
      "Contributions":["Your profile","Contributions"],
      "Applications":["Applications"]
    },
    Pinterest:{
      "Search privacy":["Profile visibility","Search privacy"],
      "Boards":["Your profile","Boards"],
      "Personalization":["Privacy and data","Personalization"],
      "Connected accounts":["Account management","Connected accounts"],
      "Discoverability":["Privacy and data","Contact syncing"]
    },
    Strava:{
      "Privacy Controls":["Privacy Controls"],
      "Profile Page":["Privacy Controls","Profile Page"],
      "Activities":["Privacy Controls","Activities"],
      "Map Visibility":["Privacy Controls","Map Visibility"],
      "Group Activities":["Privacy Controls","Group Activities"],
      "Flyby":["Privacy Controls","Flyby"]
    }
  };
  const parentRoots = {
    Instagram:["Instagram","Profile","Menu","Settings and activity","Family Center"],
    Facebook:["Facebook","Menu","Settings & privacy","Family Center"],
    TikTok:["TikTok","Profile","Menu","Settings and privacy","Family Pairing"],
    Snapchat:["Snapchat","Profile","Settings","Family Center"],
    Discord:["Discord","User Settings","Family Center"],
    YouTube:["Family Link","Child","Controls","YouTube"]
  };
  const parentBranches = {
    Instagram:{
      "Supervision":["Supervision"],
      "Teen Account":["Teen Account protections"],
      "Daily limit":["Time limits","Daily limit"],
      "Sleep mode":["Time limits","Sleep mode"],
      "Connections":["Followers and following"]
    },
    Facebook:{
      "Privacy Checkup":["Privacy Checkup"],
      "Discovery":["Privacy Checkup","How people find you"],
      "Block / Report":["Settings","Blocking"],
      "Time limits":["Device Screen Time / Family Link"]
    },
    TikTok:{
      "Pair accounts":["Link accounts"],
      "Screen time":["Daily screen time"],
      "Restricted Mode":["Restricted Mode"],
      "Search":["Search"],
      "Messages":["Direct messages"],
      "Privacy":["Privacy and discoverability"]
    },
    Snapchat:{
      "Invite":["Invite teen"],
      "Friends":["Recent friends"],
      "Snap Map":["Location","Snap Map"],
      "Sensitive content":["Content controls"],
      "Reporting":["Safety","Report or block"]
    },
    Discord:{
      "Link":["Connect accounts"],
      "Activity":["Activity insights"],
      "Safety":["Content & Social"],
      "Sensitive media":["Content & Social","Sensitive media"]
    },
    YouTube:{
      "Content level":["Content settings"],
      "History":["History controls"],
      "Autoplay":["Autoplay"],
      "Time limits":["Family Link","Screen time"]
    }
  };
  const iosPrivacy=["Settings","Privacy & Security"];
  const iosScreenTime=["Settings","Screen Time","Child"];
  const iosRestrictions=[...iosScreenTime,"Content & Privacy Restrictions"];
  const androidPermissions=["Settings","Security & privacy","Privacy","Permission manager"];
  const androidChild=["Family Link","Child"];
  const androidControls=[...androidChild,"Controls"];

  function iosPath(target,parent,steps,index,title){
    if(!parent){
      if(target==="Settings")return ["Settings"];
      if(target==="Privacy & Security")return iosPrivacy;
      if(target==="Precise Location")
        return [...iosPrivacy,"Location Services","Choose an app","Precise Location"];
      return [...iosPrivacy,target];
    }
    const earlier=steps.slice(0,index+1).some(step=>String(step?.[2]||"").replace(/^NAV:/,"")==="Family");
    if(target==="Settings")return ["Settings"];
    if(target==="Screen Time")return ["Settings","Screen Time"];
    if(target==="Family")return ["Settings","Family"];
    if(target==="Child")return earlier ? ["Settings","Family","Child"] : iosScreenTime;
    if(target==="Ask to Buy")return ["Settings","Family","Child","Ask to Buy"];
    if(["Privacy & Security","Location Services","Precise Location","Contacts","Photos"].includes(target)){
      const base=["Child's iPhone",...iosPrivacy];
      if(target==="Privacy & Security")return base;
      if(target==="Precise Location")return [...base,"Location Services","Choose an app","Precise Location"];
      return [...base,target];
    }
    if(["iTunes & App Store Purchases","App Store, Media, Web & Games","Allowed Apps & Features","Allow Changes to Settings"].includes(target))
      return [...iosRestrictions,target];
    return [...iosScreenTime,target];
  }

  function androidPath(target,parent){
    if(!parent){
      if(target==="Settings")return ["Settings"];
      if(target==="Security & privacy")return ["Settings","Security & privacy"];
      if(target==="Privacy controls")return androidPermissions;
      if(target==="Unused apps")return ["Settings","Apps","Choose an app","Pause app activity if unused"];
      if(target==="Privacy dashboard")return ["Settings","Security & privacy","Privacy","Privacy dashboard"];
      if(target==="Precise location")return [...androidPermissions,"Location","Choose an app","Use precise location"];
      return [...androidPermissions,target];
    }
    if(target==="Family Link")return ["Family Link"];
    if(target==="Child profile")return androidChild;
    if(target==="Screen time")return [...androidChild,"Screen time"];
    if(target==="Daily limit")return [...androidChild,"Screen time","Time limits","Daily limit"];
    if(target==="Downtime")return [...androidChild,"Screen time","Downtime"];
    if(target==="App limits")return [...androidChild,"Screen time","Time limits","App limits"];
    if(target==="Google Play")return [...androidControls,"Google Play"];
    if(target==="App approvals")return [...androidControls,"Google Play","Purchase & download approvals"];
    if(target==="Purchases")return [...androidControls,"Google Play","Purchase approvals"];
    if(target==="Chrome")return [...androidControls,"Google Chrome"];
    if(target==="Websites")return [...androidControls,"Google Chrome","Manage sites"];
    if(target==="SafeSearch")return [...androidControls,"Google Search","SafeSearch"];
    if(target==="YouTube")return [...androidControls,"YouTube"];
    if(target==="Contacts")return [...androidControls,"Contacts, calls & text"];
    if(target==="Device location")return [...androidChild,"Location"];
    if(target==="Precise location")return [...androidChild,"Location","Location settings"];
    if(target==="App permissions")return [...androidControls,"App permissions"];
    if(target==="Unknown apps")return [...androidControls,"Apps","Install unknown apps"];
    if(target==="Account supervision")return [...androidControls,"Account settings","Privacy settings"];
    if(target==="Parent alerts")return [...androidChild,"Notifications"];
    return [...androidControls,target];
  }

  function devicePermission(platform,target){
    const section=target==="Notifications"?"Notifications":"Location";
    return {
      path:target==="Notifications"
        ? ["iPhone Settings","Notifications",platform]
        : ["iPhone Settings","Apps",platform,"Location"],
      alternative:target==="Notifications"
        ? ["Android Settings","Apps",platform,"Notifications"]
        : ["Android Settings","Apps",platform,"Permissions","Location"],
      note:"Phone permission: iPhone path shown first; Android alternative below"
    };
  }

  function socialPath(platform,target,parent){
    if(!parent && (target==="Notifications" ||
      (target==="Location" && ["Instagram","Facebook","TikTok","WhatsApp"].includes(platform)) ||
      (target==="Precise Location" && platform==="Snapchat")))
      return devicePermission(platform,target);
    const base=parent ? (parentRoots[platform]||root[platform]||[platform,"Settings"])
      : (root[platform]||[platform,"Settings"]);
    const branchesFor=parent?(parentBranches[platform]||{}):(branches[platform]||{});
    if(platform==="Snapchat" && target==="Snap Map" && !parent)
      return {path:["Snapchat","Snap Map","Ghost Mode"]};
    if(platform==="Strava" && target==="Settings")return {path:["Strava","Settings"]};
    const baseIndex=base.indexOf(target);
    if(baseIndex>=0)return {path:base.slice(0,baseIndex+1)};
    if(Object.prototype.hasOwnProperty.call(branchesFor,target))
      return {path:[...base,...branchesFor[target]]};
    // When the guide is on a control not yet mapped, show a modest
    // root-to-setting path, never an invented multi-level hierarchy.
    return {path:[...base,target]};
  }

  function resolve({platform="",device="",parent=false,steps=[],index=0}={}){
    const current=steps[index]||[];
    let target=String(current[2]||"").replace(/^NAV:/,"").trim();
    let title=String(current[0]||"");
    if(target==="EXPLAIN" || !target){
      for(let i=index-1;i>=0;i--){
        const candidate=String(steps[i]?.[2]||"").replace(/^NAV:/,"").trim();
        if(candidate && candidate!=="EXPLAIN"){target=candidate;title=String(steps[i][0]||"");break;}
      }
    }
    const route=device==="ios" ? {path:iosPath(target,!!parent,steps,index,title)}:
      device==="android" ? {path:androidPath(target,!!parent)}:
      socialPath(platform,target,!!parent);
    let path=[...new Set((route.path||[]).map(x=>String(x||"").trim()).filter(Boolean))];
    // Do not show an empty bar even for future platforms.
    if(!path.length)path=[platform||"Settings"];
    return Object.freeze({
      path:Object.freeze(path),
      alternative:route.alternative?Object.freeze(route.alternative):null,
      note:route.note||""
    });
  }
  globalThis.GuidePaths=Object.freeze({resolve,version:"2026-10"});
})();