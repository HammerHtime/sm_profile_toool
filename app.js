(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);

  const consent = $("consent");
  const consentBox = $("consentBox");
  const liveSearchBtn = $("liveSearchBtn");
  const syntheticDemoBtn = $("syntheticDemoBtn");
  const uploadLabel = $("uploadLabel");
  const fileInput = $("fileInput");
  const scanPanel = $("scanPanel");
  const scanTitle = $("scanTitle");
  const scanSub = $("scanSub");
  const results = $("results");
  const eraseBtn = $("eraseBtn");
  const eraseNotice = $("eraseNotice");

  const SOURCE_NAMES = [
    "Instagram","Facebook","TikTok","LinkedIn","Reddit","X / Twitter","Threads","YouTube","Snapchat","Discord (public)",
    "Telegram (public)","Pinterest","Tumblr","Twitch","Bluesky","Mastodon","GitHub","Medium","Substack","Quora",
    "Flickr","Strava (public)","Steam","Goodreads","Letterboxd","Meetup","Public forums","News articles","Blogs","Event pages",
    "Organization bios","School / alumni pages","Sports results","Public comments","Public replies","Public reposts","Podcasts",
    "Press releases","Business directories","Professional directories","Public photo galleries","Google-indexed profiles","Cached snippets",
    "Public documents","Conference pages","Volunteer pages","Community pages","Marketplace profiles","Review sites","Travel posts",
    "Public playlists","Creator pages","Public repositories","Public newsletters","Public calendars","Public club pages","Public team pages",
    "Public awards pages","Public association pages"
  ];

  const PLATFORMS = [
    {name:"iPhone Privacy",icon:"●",brand:"#e7edf3",desc:"Location, precise location, contacts, photos, camera, microphone, tracking and app permissions",found:true,device:"ios"},
    {name:"Android Privacy",icon:"◆",brand:"#72d572",desc:"Permission manager, location, precise location, camera, microphone, contacts, photos and app access",found:true,device:"android"},
    {name:"Instagram",icon:"◎",brand:"#ff3d9a",desc:"Account visibility, tags, mentions, contacts, activity and location",found:true},
    {name:"Facebook",icon:"f",brand:"#1877f2",desc:"Audience, profile discovery, tagging, friends, location and off-Facebook data",found:true},
    {name:"TikTok",icon:"♪",brand:"#25f4ee",desc:"Private account, suggestions, contacts, downloads, messages and location",found:true},
    {name:"LinkedIn",icon:"in",brand:"#0a66c2",desc:"Public profile, search engines, discovery by email/phone and contact visibility",found:true},
    {name:"Reddit",icon:"●",brand:"#ff4500",desc:"Profile visibility, chat requests, followers, activity and personalization",found:true},
    {name:"X / Twitter",icon:"X",brand:"#9aa4ad",desc:"Post visibility, discoverability, location, tagging and direct messages",found:true},
    {name:"Snapchat",icon:"◻",brand:"#ffe600",desc:"Contact me, Quick Add, Snap Map, story audience and location",found:true},
    {name:"Discord",icon:"◉",brand:"#5865f2",desc:"DMs, friend requests, activity status, server privacy and discovery",found:true},
    {name:"YouTube",icon:"▶",brand:"#ff0033",desc:"Subscriptions, playlists, activity, comments and channel visibility",found:true},
    {name:"WhatsApp",icon:"☎",brand:"#25d366",desc:"Profile photo, about, status, groups, calls and live location",found:false},
    {name:"Telegram",icon:"➤",brand:"#2aabee",desc:"Phone number, last seen, forwards, groups, calls and nearby discovery",found:false},
    {name:"Twitch",icon:"▣",brand:"#9146ff",desc:"Whispers, blocked users, activity sharing and account connections",found:false},
    {name:"Strava",icon:"▲",brand:"#fc4c02",desc:"Profile, activities, maps, start/end points and flybys",found:true},
    {name:"GitHub",icon:"{ }",brand:"#cbd5e1",desc:"Profile email, contribution activity, public repositories and commits",found:false},
    {name:"Pinterest",icon:"P",brand:"#e60023",desc:"Search privacy, personalization, connected accounts and boards",found:false}
  ];

  const PARENT_PLATFORMS = [
    {name:"Instagram",icon:"◎",brand:"#ff3d9a",desc:"Teen Accounts, messaging, sensitive content, time limits and supervision"},
    {name:"Facebook",icon:"f",brand:"#1877f2",desc:"Family Center, audience, blocking, privacy checks and time tools"},
    {name:"TikTok",icon:"♪",brand:"#25f4ee",desc:"Family Pairing, screen time, search, messages, restricted mode and privacy"},
    {name:"Snapchat",icon:"◻",brand:"#ffe600",desc:"Family Center, friends, contacts, location and sensitive content controls"},
    {name:"Discord",icon:"◉",brand:"#5865f2",desc:"Family Center, message requests, server safety and content filters"},
    {name:"YouTube",icon:"▶",brand:"#ff0033",desc:"Supervised accounts, Restricted Mode, history, content levels and time controls"}
  ];

  const DEVICE_GUIDES = [
    {name:"iPhone / iPad",icon:"●",brand:"#e7edf3",desc:"Screen Time, Communication Safety, app installs, contacts, web content, privacy, location, purchases and downtime",device:"ios"},
    {name:"Android / Family Link",icon:"◆",brand:"#72d572",desc:"Family Link, app approvals, location, Chrome, Search, YouTube, contacts, purchases, limits and bedtime",device:"android"}
  ];

  const genericGuide = {
    "Instagram":[
      ["Open Instagram","Tap your profile picture in the bottom-right.","Profile"],
      ["Open the menu","Tap the three-line menu in the top-right.","Menu"],
      ["Open Settings and activity","This is where Instagram groups privacy and safety controls.","Settings and activity"],
      ["Account privacy","Open Account privacy.","Account privacy"],
      ["Turn on Private account","Only approved followers can see private-account posts.","Private account"],
      ["Why this matters","A private account reduces casual discovery and limits who can see future posts. Existing followers remain until removed.","EXPLAIN"],
      ["Tags and mentions","Return to Settings and activity, then open Tags and mentions.","Tags and mentions"],
      ["Limit tags and mentions","Choose People you follow or Don't allow where appropriate.","Tags / Mentions"],
      ["Why this matters","This reduces unwanted links between your profile and other people's content, which can reveal relationships, places and events.","EXPLAIN"],
      ["Messages and story replies","Open Messages and story replies.","Messages and story replies"],
      ["Limit message requests","Reduce who can send requests or add you to group chats.","Message controls"],
      ["Contacts syncing","Find Follow and invite friends / contacts syncing and turn off ongoing contact upload if not needed.","Contact syncing"],
      ["Why this matters","Contact uploads can help platforms suggest you to people who already have your phone number or email.","EXPLAIN"]
    ],
    "Facebook":[
      ["Open Facebook","Tap Menu.","Menu"],
      ["Settings & privacy","Open Settings & privacy.","Settings & privacy"],
      ["Privacy Checkup","Open Privacy Checkup.","Privacy Checkup"],
      ["Who can see what you share","Review posts, stories, profile details and friends list.","Audience"],
      ["Future posts","Set the audience you actually intend, often Friends rather than Public.","Future posts"],
      ["Why this matters","Public posts can be indexed, reshared and connected across years of activity.","EXPLAIN"],
      ["How people find you","Review lookup by email and phone number.","How people find you"],
      ["Search engine links","Turn off allowing search engines outside Facebook to link to your profile if you don't want that exposure.","Search engines"],
      ["Location permissions","Review Facebook's device-level location access and background access.","Location"],
      ["Why this matters","Reducing discovery and location access makes it harder to connect contact details and routines to your public profile.","EXPLAIN"]
    ],
    "TikTok":[
      ["Open TikTok","Tap Profile.","Profile"],
      ["Open Menu","Tap the three-line menu.","Menu"],
      ["Settings and privacy","Open Settings and privacy.","Settings and privacy"],
      ["Privacy","Open Privacy.","Privacy"],
      ["Private account","Turn on Private account if public reach is not required.","Private account"],
      ["Suggest your account to others","Review every suggestion switch.","Suggest account"],
      ["Sync contacts","Turn off contact syncing if you do not need it, and remove previously synced contacts where available.","Sync contacts"],
      ["Downloads","Turn off video downloads if you don't want other users saving copies.","Downloads"],
      ["Direct messages","Restrict who can message you.","Direct messages"],
      ["Location Services","Review device-level TikTok location permission and disable precise location unless needed.","Location"],
      ["Why this matters","These controls reduce discoverability, contact-based matching, copies of your content and precise location exposure.","EXPLAIN"]
    ],
    "LinkedIn":[
      ["Open LinkedIn","Tap your profile picture, then Settings.","Settings"],
      ["Visibility","Open Visibility.","Visibility"],
      ["Edit your public profile","Open Edit your public profile.","Public profile"],
      ["Public visibility","Limit what search engines and people outside LinkedIn can see.","Public profile visibility"],
      ["Profile discovery using email","Open profile discovery using email address.","Email discovery"],
      ["Restrict discovery","Choose the least permissive option that still works for you.","Email discovery"],
      ["Profile discovery using phone","Repeat for phone number discovery.","Phone discovery"],
      ["Who can see your email","Limit email visibility.","Email visibility"],
      ["Why this matters","LinkedIn often bridges professional identity with phone numbers, email addresses, employers and search-engine results.","EXPLAIN"]
    ],
    "Reddit":[
      ["Open Reddit","Tap your avatar.","Profile menu"],
      ["Settings","Open Settings.","Settings"],
      ["Account settings","Open your username/account settings.","Account settings"],
      ["Chat & messaging","Restrict chat requests and direct messages.","Chat requests"],
      ["Followers","Review whether people can follow your profile.","Followers"],
      ["Personalization","Review personalized recommendations and activity-based suggestions.","Personalization"],
      ["Profile history","Remember that posts and comments can form a long-lived public history even when the display name is pseudonymous.","Public activity"],
      ["Why this matters","Repeated usernames, communities, comments and posting times can connect a pseudonymous account to a broader public footprint.","EXPLAIN"]
    ],
    "Snapchat":[
      ["Open Snapchat","Tap your Bitmoji/profile.","Profile"],
      ["Settings","Tap the gear.","Settings"],
      ["Contact Me","Open Contact Me and limit who can contact you.","Contact Me"],
      ["View My Story","Set the intended story audience.","Story audience"],
      ["See Me in Quick Add","Turn off if you don't want broad friend suggestions.","Quick Add"],
      ["Snap Map","Open location settings and use Ghost Mode when appropriate.","Snap Map"],
      ["Precise location","At the phone level, disable precise location if the feature doesn't require it.","Precise Location"],
      ["Why this matters","Snap Map and friend-discovery features can reveal routines, associations and location if configured broadly.","EXPLAIN"]
    ],
    "Discord":[
      ["Open Discord","Open User Settings.","User Settings"],
      ["Content & Social","Open Content & Social / Privacy & Safety.","Content & Social"],
      ["Direct messages","Disable DMs from server members where appropriate.","Server DMs"],
      ["Message requests","Restrict message requests from people you don't know.","Message requests"],
      ["Friend requests","Limit who can send friend requests.","Friend requests"],
      ["Activity privacy","Turn off sharing current activity if you don't want apps/games broadcast.","Activity privacy"],
      ["Why this matters","Public servers, shared activity and open DMs can expose usernames, communities, schedules and interests.","EXPLAIN"]
    ],
    "YouTube":[
      ["Open YouTube","Tap your profile image.","Profile"],
      ["Settings","Open Settings.","Settings"],
      ["Privacy","Open Privacy.","Privacy"],
      ["Keep subscriptions private","Turn on private subscriptions if you don't want them visible.","Subscriptions"],
      ["Keep saved playlists private","Review playlist visibility individually.","Playlists"],
      ["History","Review watch and search history controls.","History"],
      ["Comments","Review your public comments and channel identity.","Comments"],
      ["Why this matters","Subscriptions, playlists and years of comments can reveal interests and connect otherwise separate accounts.","EXPLAIN"]
    ],
    "X / Twitter":[
      ["Open X","Open Settings and privacy.","Settings and privacy"],
      ["Privacy and safety","Open Privacy and safety.","Privacy and safety"],
      ["Audience, media and tagging","Review post protection and photo tagging.","Audience / tagging"],
      ["Protect your posts","Enable if you want posts limited to approved followers.","Protect posts"],
      ["Discoverability and contacts","Open Discoverability and contacts.","Discoverability"],
      ["Email / phone discovery","Turn off discovery by email and phone if not needed.","Discovery"],
      ["Location information","Review location information and remove location history from posts if available.","Location"],
      ["Why this matters","These controls reduce contact-based account matching and public indexing of posts and location clues.","EXPLAIN"]
    ],
    "WhatsApp":[
      ["Open WhatsApp","Open Settings.","Settings"],
      ["Privacy","Open Privacy.","Privacy"],
      ["Last seen & online","Choose who can see your activity.","Last seen"],
      ["Profile photo","Limit visibility to contacts if appropriate.","Profile photo"],
      ["About and Status","Review both audiences.","About / Status"],
      ["Groups","Limit who can add you to groups.","Groups"],
      ["Live location","Review and stop any active live-location shares.","Live location"],
      ["Why this matters","WhatsApp can expose presence, profile imagery, group connections and live location to broader audiences than intended.","EXPLAIN"]
    ],
    "Telegram":[
      ["Open Telegram","Open Settings.","Settings"],
      ["Privacy and Security","Open Privacy and Security.","Privacy and Security"],
      ["Phone Number","Set who can see your number and who can find you by number.","Phone Number"],
      ["Last Seen & Online","Restrict visibility as desired.","Last seen"],
      ["Forwarded Messages","Limit account links when messages are forwarded.","Forwarded messages"],
      ["Groups & Channels","Limit who can add you.","Groups & Channels"],
      ["People Nearby","Keep nearby discovery off unless actively using it.","People Nearby"],
      ["Why this matters","Phone-number visibility and nearby discovery can connect an otherwise pseudonymous Telegram account to a real-world identity.","EXPLAIN"]
    ],
    "Twitch":[
      ["Open Twitch","Tap your profile image and open Settings.","Settings"],
      ["Security and Privacy","Open Security and Privacy.","Security and Privacy"],
      ["Block unwanted users","Review blocked users and use blocking when needed.","Blocked users"],
      ["Whispers","Review who can send Whispers and use safety controls for unwanted contact.","Whispers"],
      ["Activity sharing","Review whether your activity, connections or linked accounts reveal more than intended.","Activity"],
      ["Connections","Review connected accounts and revoke services you no longer use.","Connections"],
      ["Why this matters","Public streams, chat history, linked accounts and activity patterns can connect a gaming identity to a broader public profile.","EXPLAIN"]
    ],
    "GitHub":[
      ["Open GitHub","Open your profile, then Settings.","Settings"],
      ["Public profile","Review the name, bio, company, location and website fields shown publicly.","Public profile"],
      ["Public email","Make sure your public profile email is hidden unless you intentionally want it visible.","Public email"],
      ["Email privacy","In Emails, keep your email private and use GitHub's no-reply address for commits when appropriate.","Email privacy"],
      ["Public repositories","Review repositories, issue comments, pull requests and commit history that are visible publicly.","Public repositories"],
      ["Contribution activity","Review whether public contribution activity reveals work patterns, projects or organizations.","Contributions"],
      ["Connected applications","Remove OAuth apps or integrations you no longer use.","Applications"],
      ["Why this matters","GitHub can connect a username to an email address, employer, technical interests, project history and years of timestamped activity.","EXPLAIN"]
    ],
    "Pinterest":[
      ["Open Pinterest","Open your profile, then Settings.","Settings"],
      ["Profile visibility","Review whether your profile can appear in search engines.","Search privacy"],
      ["Boards","Review each board and make sensitive boards secret where appropriate.","Boards"],
      ["Personalization","Review personalization and activity-based recommendations.","Personalization"],
      ["Connected accounts","Review linked social or sign-in accounts and remove connections you no longer need.","Connected accounts"],
      ["Contacts and discovery","Review contact syncing or discovery features if enabled.","Discoverability"],
      ["Why this matters","Public boards can reveal interests, purchases, travel plans, home projects and other patterns that become useful identity clues.","EXPLAIN"]
    ],
    "Strava":[
      ["Open Strava","Open Settings.","Settings"],
      ["Privacy Controls","Open Privacy Controls.","Privacy Controls"],
      ["Profile Page","Set who can see profile details.","Profile Page"],
      ["Activities","Set the default activity audience.","Activities"],
      ["Map Visibility","Hide start and end points around sensitive locations such as home or school.","Map Visibility"],
      ["Group Activities","Review group-activity visibility.","Group Activities"],
      ["Flyby","Disable Flyby if you don't want activity proximity exposed.","Flyby"],
      ["Why this matters","Fitness routes can reveal home, school, work, routines and predictable times even when no address is posted.","EXPLAIN"]
    ]
  };

  function fallbackGuide(name) {
    return [
      ["Open " + name,"Open the app and go to your profile or account menu.","Profile / Menu"],
      ["Open Settings","Look for Settings, Privacy, Safety or Account.","Settings"],
      ["Find Privacy","Open the main privacy or visibility section.","Privacy"],
      ["Review public visibility","Limit profile, posts, activity or followers to the audience you actually intend.","Visibility"],
      ["Review discoverability","Look for contact syncing, phone/email discovery and account suggestions.","Discoverability"],
      ["Review location","Disable background or precise location unless the feature genuinely requires it.","Location"],
      ["Review messages and interactions","Limit who can message, mention, tag, add or follow you.","Interactions"],
      ["Why this matters","Every public profile, contact-matching feature and location signal can become another breadcrumb that connects accounts together.","EXPLAIN"]
    ];
  }

  const parentGuides = {
    "Instagram":[
      ["Open Instagram Family Center","On the parent's account, open Settings and activity, then Family Center / Supervision.","Family Center"],
      ["Invite the teen","Send or accept the supervision invitation with the teen.","Supervision"],
      ["Review Teen Account protections","Check account privacy, messaging restrictions, tags, mentions and sensitive-content protections.","Teen Account"],
      ["Set daily limit","Choose a daily usage limit appropriate for your family.","Daily limit"],
      ["Set sleep mode","Configure overnight quiet/sleep hours.","Sleep mode"],
      ["Review contacts and connections","Use supervision tools to understand changes in followers/following without reading private messages.","Connections"],
      ["Why it matters","Supervision is designed to give parents safety controls and visibility into settings while preserving some teen privacy.","EXPLAIN"]
    ],
    "TikTok":[
      ["Open Family Pairing","Parent: Profile → Menu → Settings and privacy → Family Pairing.","Family Pairing"],
      ["Link parent and teen","Choose Parent / Teen and scan the pairing QR code.","Pair accounts"],
      ["Daily screen time","Set a daily limit and schedule breaks.","Screen time"],
      ["Restricted Mode","Turn on Restricted Mode when appropriate.","Restricted Mode"],
      ["Search","Decide whether the teen can search videos, hashtags and sounds.","Search"],
      ["Direct messages","Set who can send direct messages based on age and family preference.","Messages"],
      ["Privacy and discoverability","Review private account, suggestions, downloads, comments, Duet and Stitch.","Privacy"],
      ["Why it matters","Family Pairing centralizes the settings most likely to affect unwanted contact, discovery and excessive use.","EXPLAIN"]
    ],
    "Snapchat":[
      ["Open Family Center","Parent opens Snapchat Family Center.","Family Center"],
      ["Invite the teen","Send the teen a Family Center invitation.","Invite"],
      ["Friends and contacts","Review recent friends and who the teen is communicating with, where supported.","Friends"],
      ["Location","Review Snap Map and make sure location sharing matches your family's expectation.","Snap Map"],
      ["Sensitive content","Use Family Center content controls where available.","Sensitive content"],
      ["Report concerns","Use in-app reporting and blocking when something feels wrong.","Reporting"],
      ["Why it matters","The strongest protections are location awareness, knowing who can contact the teen and keeping friend discovery limited.","EXPLAIN"]
    ],
    "Discord":[
      ["Open Family Center","Parent and teen both open Family Center.","Family Center"],
      ["Link accounts","Teen shares the QR code; parent scans it.","Link"],
      ["Activity insights","Review high-level server and contact activity available to the parent.","Activity"],
      ["Safety setup","Teen: Content & Social → review DMs, message requests and friend requests.","Safety"],
      ["Sensitive media protections","Enable available sensitive-media filtering or warnings.","Sensitive media"],
      ["Why it matters","Family Center can support conversation about who the teen interacts with without handing parents the contents of private messages.","EXPLAIN"]
    ],
    "YouTube":[
      ["Create / use a supervised Google account","Use Family Link or a supervised YouTube experience.","Supervised account"],
      ["Choose content setting","Select the content level appropriate to the child's age.","Content level"],
      ["Search and history","Decide whether search and watch history should be available or paused.","History"],
      ["Autoplay","Turn off Autoplay if you want stronger stopping points.","Autoplay"],
      ["Time controls","Use Family Link / Digital Wellbeing for daily limits and bedtime.","Time limits"],
      ["Why it matters","Content level plus device-level time controls gives stronger protection than relying on Restricted Mode alone.","EXPLAIN"]
    ],
    "Facebook":[
      ["Open Family Center / supervision","Open Meta's family supervision tools where available for the teen account.","Family Center"],
      ["Privacy Checkup","Walk through who can see posts, stories and profile details.","Privacy Checkup"],
      ["Friend requests and discovery","Restrict who can send requests and how the account can be found.","Discovery"],
      ["Blocking and reporting","Show the teen how to block and report quickly.","Block / Report"],
      ["Time controls","Use device Screen Time / Family Link for reliable daily limits.","Time limits"],
      ["Why it matters","Account privacy plus device controls reduces unwanted contact and public oversharing.","EXPLAIN"]
    ]
  };

  const iosPrivacy = [
    ["Open Settings","Open Settings on the iPhone.","Settings"],
    ["Privacy & Security","Scroll to Privacy & Security.","Privacy & Security"],
    ["Location Services","Open Location Services to review every app with location access.","Location Services"],
    ["Review app access","For each app, choose Never, Ask Next Time, While Using, or Always based on what the app actually needs.","Location Services"],
    ["Precise Location","Turn off Precise Location for apps that only need a general area.","Precise Location"],
    ["Tracking","Return to Privacy & Security and open Tracking. Limit cross-app tracking where appropriate.","Tracking"],
    ["Contacts","Review which apps can access your contacts.","Contacts"],
    ["Photos","Review photo-library access. Use limited access when an app does not need the full library.","Photos"],
    ["Camera","Review which apps can use the camera.","Camera"],
    ["Microphone","Review which apps can use the microphone.","Microphone"],
    ["Local Network","Review which apps can discover devices on your local network.","Local Network"],
    ["Safety Check","For personal-safety situations, review Apple's Safety Check tools for sharing and account access.","Safety Check"],
    ["Why this matters","Device permissions can reveal location, contacts, photos and nearby devices even when your social profile itself is private.","EXPLAIN"]
  ];

  const androidPrivacy = [
    ["Open Settings","Open Settings on the Android device.","Settings"],
    ["Security & privacy","Open Security & privacy. Menu wording can vary by manufacturer.","Security & privacy"],
    ["Privacy controls","Open Privacy or Permission manager.","Privacy controls"],
    ["Location","Review which apps can access location and whether they can use it all the time or only while in use.","Location"],
    ["Precise location","Where supported, turn off precise location for apps that only need an approximate area.","Precise location"],
    ["Camera","Review camera permission by app.","Camera"],
    ["Microphone","Review microphone permission by app.","Microphone"],
    ["Photos and videos","Review which apps can access photos and videos. Use selected-photo access where available.","Photos and videos"],
    ["Contacts","Review contacts permission and remove access from apps that do not need your address book.","Contacts"],
    ["Unused apps","Review permission auto-reset or pause-app-activity features for apps you no longer use.","Unused apps"],
    ["Privacy dashboard","Use Privacy dashboard to see recent access to sensitive permissions.","Privacy dashboard"],
    ["Why this matters","Android permission history can show which apps are accessing location, camera and microphone, helping reduce unnecessary exposure.","EXPLAIN"]
  ];

  const iosParent = [
    ["Open Settings","On the parent's iPhone, open Settings.","Settings"],
    ["Open Family","Tap Family.","Family"],
    ["Select your child","Tap the child's name in the Family group.","Child"],
    ["Open Screen Time","Tap Screen Time. In iOS 27, this opens the updated parental-control experience.","Screen Time"],
    ["Apps & Websites","Review which apps and websites the child can access. This is also where Ask to Buy and Ask to Browse protections can apply.","Apps & Websites"],
    ["Allowed Contacts","Review who the child can communicate with in Messages, FaceTime and Phone, including approval for new contacts where supported.","Allowed Contacts"],
    ["Time Allowances","Set daily time budgets for categories such as entertainment, games and social media.","Time Allowances"],
    ["Screen Time Schedules","Create school, after-school, evening or weekend routines for when apps can be used.","Screen Time Schedules"],
    ["Content & Privacy Restrictions","Manage age ratings, apps, content and whether the child can change sensitive device settings.","Content & Privacy Restrictions"],
    ["Communication Safety","Open Communication Safety and review the protection for the child account.","Communication Safety"],
    ["What Communication Safety does","On supported Apple services, on-device detection can warn and blur sensitive photos or videos before they are viewed or sent. Apple does not receive the image merely because sensitive content was detected.","EXPLAIN"],
    ["Extra protection for younger children","With a Screen Time passcode, children under 13 can require a parent or guardian to enter the passcode before viewing detected sensitive content. This is not a system that simply forwards the child's image to the parent.","EXPLAIN"],
    ["Open Privacy & Security","On the child's iPhone, return to Settings and open Privacy & Security.","Privacy & Security"],
    ["Location Services","Open Location Services and review which apps can use the child's location.","Location Services"],
    ["Precise Location","For apps that only need a general area, turn off Precise Location where appropriate.","Precise Location"],
    ["Contacts","Return to Privacy & Security and review which apps can access Contacts.","Contacts"],
    ["Photos","Review Photos access and use limited-library access where a full photo library is not required.","Photos"],
    ["Finish with the child","Review the most-used apps together and explain why each protection exists. The goal is safer habits, not just locked settings.","EXPLAIN"]
  ];

  const androidParent = [
    ["Install / open Family Link","Parent opens Google Family Link and confirms the child's supervised Google Account.","Family Link"],
    ["Select the child","Choose the child's profile.","Child profile"],
    ["Controls","Open Controls.","Controls"],
    ["Daily limit","Set the total daily device limit.","Daily limit"],
    ["Downtime","Set bedtime / school-night downtime.","Downtime"],
    ["App limits","Set individual limits or block specific apps.","App limits"],
    ["Google Play controls","Open Content restrictions → Google Play.","Google Play"],
    ["App approvals","Require parent approval for app downloads or purchases.","App approvals"],
    ["Purchase approvals","Choose which purchases need approval.","Purchases"],
    ["Chrome","Open Content restrictions → Google Chrome.","Chrome"],
    ["Website controls","Try to block explicit sites or allow only approved sites for younger children.","Websites"],
    ["Google Search","Enable SafeSearch controls where supervision supports them.","SafeSearch"],
    ["YouTube","Choose a supervised YouTube experience / content setting.","YouTube"],
    ["Contacts","Review communication / contacts controls available for the child's device and apps.","Contacts"],
    ["Location","Open Location in Family Link.","Location"],
    ["Device location","Choose whether the parent can see the child's supervised device location.","Device location"],
    ["App permissions","Review location, camera, microphone, contacts, photos/files permissions app by app.","App permissions"],
    ["Precise location","On Android app permissions, disable precise location where an approximate location is enough.","Precise location"],
    ["Unknown apps / sideloading","Keep installation from unknown sources off unless you intentionally need it.","Unknown apps"],
    ["Account changes","Keep the supervised account linked and protect parent settings.","Account supervision"],
    ["Notifications","Choose which Family Link notifications the parent should receive, including app requests and account changes.","Parent alerts"],
    ["Why it matters","Family Link combines device limits, app approval, web/content controls, location and permission review in one parent dashboard.","EXPLAIN"]
  ];

  function syntheticReport() {
    const first = $("firstName")?.value.trim() || "Demo";
    const last = $("lastName")?.value.trim() || "Participant";
    const subject = (first + " " + last).trim();

    return {
      dataMode:"synthetic",
      synthetic:true,
      subject,
      score:86,
      level:"SYNTHETIC DEMO",
      stats:[
        {n:9,k:"sample accounts"},
        {n:684,k:"sample public images"},
        {n:19,k:"sample recurring people"},
        {n:27,k:"sample location signals"}
      ],
      findings:[
        ["Previous addresses","4 synthetic historical address references. Example: 123 xxxxx St.","SYNTHETIC"],
        ["Phone numbers","2 synthetic phone references. Example: 416-xxx-xx02.","SYNTHETIC"],
        ["Email addresses","3 synthetic email references. Example: an•••••@g•••.com.","SYNTHETIC"],
        ["Education","2 synthetic education records. Institution names hidden.","SYNTHETIC"],
        ["Employment","6 synthetic employment / organization associations.","SYNTHETIC"],
        ["Images","684 synthetic public-image records grouped by what they reveal.","SYNTHETIC"],
        ["Public activity","1,526 synthetic posts, comments, replies, shares and mentions.","SYNTHETIC"]
      ],
      accounts:[
        ["Instagram","@ale••••••n02"],
        ["Facebook","alex••••••••onto"],
        ["TikTok","@am••••••02"],
        ["LinkedIn","alex••••••••4821"],
        ["Reddit","u/ale••••••n02"],
        ["X / Twitter","@ale••••n"],
        ["YouTube","Alex•••••02"],
        ["Strava","A••x M••••n"]
      ],
      sourceCoverage:{
        searched:12,
        matched:9,
        sources:[
          {name:"LinkedIn",matched:true},
          {name:"Instagram",matched:true},
          {name:"Facebook",matched:true},
          {name:"TikTok",matched:true},
          {name:"Threads",matched:false},
          {name:"Reddit",matched:true},
          {name:"X / Twitter",matched:true},
          {name:"YouTube",matched:true},
          {name:"Strava",matched:true},
          {name:"GitHub",matched:false},
          {name:"Medium",matched:false},
          {name:"Substack",matched:true}
        ]
      },
      publicSources:[],
      imageBreakdown:[
        ["Friends / family / social groups",352],
        ["Travel destinations",134],
        ["Sports and activities",54],
        ["Vehicles",44],
        ["Food / restaurants",39],
        ["Work / public events",26],
        ["Pets",17],
        ["Home / property clues",11],
        ["Documents / screenshots",7]
      ],
      activity:[
        ["Posts and captions",614],
        ["Comments",382],
        ["Replies",216],
        ["Shares / reposts",131],
        ["Forum contributions",97],
        ["News / article mentions",86]
      ],
      themes:["Travel","Sports","Restaurants","Technology","Vehicles","Community events","Professional topics","Photography"],
      signals:[
        ["◎","Identity linking","Synthetic repeated usernames, contact fragments and bios connect sample accounts together."],
        ["⌖","Routine & location","Synthetic location signals demonstrate how routines and travel patterns can appear."],
        ["◌","Social network","Synthetic recurring people demonstrate how public relationships could be mapped."],
        ["✎","Public voice","Synthetic posts, comments and mentions demonstrate a long-lived public record."],
        ["▣","Image history","Synthetic images demonstrate how destinations, activities, vehicles and events can create exposure."],
        ["◷","Time depth","Synthetic material demonstrates how years of public history can form a timeline."]
      ]
    };
  }

async function checkLiveSearchReady() {
    const status = document.querySelector(".buildStatus");
    if (!status || !liveSearchBtn) return;

    try {
      const res = await fetch("/.netlify/functions/live-search", { method:"GET", cache:"no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.configured) {
        status.classList.add("liveConfigured");
        status.classList.remove("liveUnconfigured");
        status.innerHTML = '<span class="statusDot"></span><strong>Live Search ready.</strong> Real public/indexed searches are configured. Synthetic Demo remains available as a clearly labelled fallback.';
        liveSearchBtn.dataset.configured = "true";
      } else {
        status.classList.add("liveUnconfigured");
        status.classList.remove("liveConfigured");
        status.innerHTML = '<span class="statusDot"></span><strong>Live Search needs configuration.</strong> Add <b>BRAVE_SEARCH_API_KEY</b> in Netlify environment variables. Synthetic Demo and the privacy walkthroughs still work.';
        liveSearchBtn.dataset.configured = "false";
      }
    } catch (e) {
      status.classList.add("liveUnconfigured");
      status.innerHTML = '<span class="statusDot"></span><strong>Live Search readiness could not be confirmed.</strong> Synthetic Demo and the privacy walkthroughs remain available.';
      liveSearchBtn.dataset.configured = "unknown";
    }
  }

function setConsentState() {
    const ok = !!consent.checked;
    if (liveSearchBtn) liveSearchBtn.disabled = !ok;
    if (syntheticDemoBtn) syntheticDemoBtn.disabled = !ok;
    fileInput.disabled = !ok;
    uploadLabel.classList.toggle("disabled", !ok);
    uploadLabel.setAttribute("aria-disabled", ok ? "false" : "true");
    consentBox.classList.toggle("approved", ok);
  }

  function scanSequence(done) {
    const steps = [
      ["Searching public sources…","Checking social networks, news, forums, public directories and indexed pages."],
      ["Linking public identifiers…","Comparing names, usernames and public profile fragments."],
      ["Analyzing images and activity…","Classifying what public material reveals without exposing sensitive values."],
      ["Masking sensitive findings…","Removing complete phone numbers, email addresses, school names and precise addresses."],
      ["Building the privacy report…","Turning hundreds of fragments into an educational summary."]
    ];
    results.classList.add("hidden");
    scanPanel.classList.remove("hidden");
    let i = 0;
    scanTitle.textContent = steps[0][0];
    scanSub.textContent = steps[0][1];
    const timer = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(timer);
        setTimeout(() => { scanPanel.classList.add("hidden"); done(); }, 350);
        return;
      }
      scanTitle.textContent = steps[i][0];
      scanSub.textContent = steps[i][1];
    }, 480);
  }

  function renderReport(report) {
    const mode = report.dataMode === "verified" ? "verified" : report.dataMode === "synthetic" ? "synthetic" : "evidence";
    const banner = $("dataModeBanner");
    const modeLabel = mode === "verified" ? "VERIFIED" : mode === "synthetic" ? "SYNTHETIC" : "EVIDENCE FILE";
    const modeClass = mode;

    if (banner) {
      banner.className = "dataModeBanner " + modeClass;
      if (mode === "verified") {
        banner.innerHTML = "<strong>VERIFIED PUBLIC FINDINGS</strong><span>These findings were returned by configured public-source collectors and include the public source URL for review.</span>";
      } else if (mode === "synthetic") {
        banner.innerHTML = "<strong>SYNTHETIC DEMONSTRATION DATA</strong><span>Everything on this result screen is fabricated to demonstrate what the presentation can look like. Nothing here was found about the person entered.</span>";
      } else {
        banner.innerHTML = "<strong>USER-SUPPLIED EVIDENCE</strong><span>This report summarizes the JSON file you uploaded. It has not been independently verified by this app as a live public-source search.</span>";
      }
    }

    $("subjectName").textContent = report.subject || "Search Subject";
    $("summaryLine").textContent = mode === "verified"
      ? "Verified public-source findings, privacy-masked before display."
      : mode === "synthetic"
        ? "Synthetic fallback presentation. No live public search produced these values."
        : "Summary of user-supplied evidence. Not independently verified by this build.";
    $("score").textContent = report.score || 0;
    $("scoreLabel").textContent = report.level || "LOW";

    $("stats").innerHTML = "";
    (report.stats || []).forEach((s) => {
      const el = document.createElement("div");
      el.className = "stat";
      el.innerHTML = '<div class="provenanceMini ' + modeClass + '">' + escapeHtml(modeLabel) + '</div><div class="n">' + escapeHtml(s.n) + '</div><div class="k">' + escapeHtml(s.k) + "</div>";
      $("stats").appendChild(el);
    });

    $("findingRows").innerHTML = "";
    (report.findings || []).forEach((f) => {
      const row = document.createElement("div");
      row.className = "findingRow";
      row.innerHTML =
        '<div class="cat">' + escapeHtml(f[0]) + '<div class="provenanceMini ' + modeClass + '">' + escapeHtml(modeLabel) + '</div></div>' +
        '<div class="desc">' + escapeHtml(f[1]) + '</div><div class="badge">' + escapeHtml(f[2]) + "</div>";
      $("findingRows").appendChild(row);
    });

    const accountPanel = $("accountMatchesPanel");
    accountPanel.classList.toggle("hidden", !(report.accounts || []).length);
    $("accountMatchesGrid").innerHTML = "";
    (report.accounts || []).forEach((a) => {
      const card = document.createElement("div");
      card.className = "accountMatch";
      card.innerHTML = '<div class="provenanceMini ' + modeClass + '">' + escapeHtml(modeLabel) + '</div><strong>' + escapeHtml(a[0]) + '</strong><div class="maskedHandle">' + escapeHtml(a[1]) + "</div>";
      $("accountMatchesGrid").appendChild(card);
    });

    const sourcePanel = $("sourceCoveragePanel");
    $("sourceCoverageGrid").innerHTML = "";
    if ((mode === "verified" || mode === "synthetic") && report.sourceCoverage) {
      sourcePanel.classList.remove("hidden");
      $("sourceSearched").textContent = report.sourceCoverage.searched || 0;
      $("sourceMatched").textContent = report.sourceCoverage.matched || 0;
      (report.sourceCoverage.sources || []).forEach((source) => {
        const chip = document.createElement("div");
        chip.className = "sourceChip" + (source.matched ? " hit" : "");
        chip.innerHTML = '<span class="sourceModeDot ' + modeClass + '"></span>' + (source.matched ? "✓ " : "○ ") + escapeHtml(source.name);
        $("sourceCoverageGrid").appendChild(chip);
      });
    } else {
      sourcePanel.classList.add("hidden");
    }


    const publicSourcesPanel = $("publicSourcesPanel");
    const publicSourcesGrid = $("publicSourcesGrid");
    if (publicSourcesPanel && publicSourcesGrid) {
      publicSourcesGrid.innerHTML = "";
      const publicSources = report.publicSources || [];
      publicSourcesPanel.classList.toggle("hidden", !publicSources.length);

      publicSources.forEach((source) => {
        const card = document.createElement("a");
        card.className = "publicSourceCard " + (source.confidence === "strong" ? "strongMatch" : "possibleMatch");
        card.href = source.url;
        card.target = "_blank";
        card.rel = "noopener noreferrer";

        const reasons = (source.reasons || []).join(" • ");
        card.innerHTML =
          '<div class="publicSourceTop">' +
            '<span class="publicSourcePlatform">' + escapeHtml(source.platform || source.domain || "Public web") + '</span>' +
            '<span class="matchConfidence ' + (source.confidence || "possible") + '">' +
              (source.confidence === "strong" ? "STRONG MATCH" : "POSSIBLE MATCH") +
            '</span>' +
          '</div>' +
          '<strong>' + escapeHtml(source.title || source.domain || "Public result") + '</strong>' +
          '<p>' + escapeHtml(source.snippet || "Open the source to review this result.") + '</p>' +
          '<div class="publicSourceMeta">' +
            '<span>' + escapeHtml(source.domain || "") + '</span>' +
            '<span>' + escapeHtml(reasons || "name match") + '</span>' +
          '</div>';
        publicSourcesGrid.appendChild(card);
      });
    }

    $("profileSignalsPanel").classList.toggle("hidden", !(report.signals || []).length);
    $("profileSignalsGrid").innerHTML = "";
    (report.signals || []).forEach((s) => {
      const card = document.createElement("div");
      card.className = "signalCard";
      card.innerHTML = '<div class="provenanceMini ' + modeClass + '">' + escapeHtml(modeLabel) + '</div><div class="signalIcon">' + escapeHtml(s[0]) + "</div><strong>" + escapeHtml(s[1]) + "</strong><p>" + escapeHtml(s[2]) + "</p>";
      $("profileSignalsGrid").appendChild(card);
    });

    const exposurePanel = $("exposureDetailPanel");
    const hasExposure = (report.imageBreakdown || []).length || (report.activity || []).length || (report.themes || []).length;
    exposurePanel.classList.toggle("hidden", !hasExposure);
    if (hasExposure) {
      $("imageTotal").textContent = (report.stats && report.stats[1]) ? report.stats[1].n : 0;
      $("activityTotal").textContent = (report.activity || []).reduce((sum, x) => sum + Number(x[1] || 0), 0);
      renderBreakdown("imageBreakdown", report.imageBreakdown || []);
      renderBreakdown("activityTypes", report.activity || []);
      $("themeBreakdown").innerHTML = '<span class="provenanceMini ' + modeClass + '">' + escapeHtml(modeLabel) + '</span>';
      (report.themes || []).forEach((t) => {
        const el = document.createElement("span");
        el.className = "themePill";
        el.textContent = t;
        $("themeBreakdown").appendChild(el);
      });
    }

    $("takeaway").textContent = mode === "synthetic"
      ? "Synthetic mode is a visual fallback only. Use it to demonstrate capabilities when a live search returns little or nothing. Do not present these values as findings."
      : "One post is a fragment. Hundreds of verified or supplied fragments can become a profile. Always check the provenance label and source before treating a value as a real finding.";
    results.classList.remove("hidden");
    results.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function renderBreakdown(id, items) {
    const root = $(id);
    root.innerHTML = "";
    const max = Math.max(1, ...items.map((x) => Number(x[1] || 0)));
    items.forEach((x) => {
      const row = document.createElement("div");
      row.className = "breakdownRow";
      const pct = Math.max(5, Math.round(Number(x[1]) / max * 100));
      row.innerHTML = "<span>" + x[0] + "</span><strong>" + x[1] + '</strong><div class="breakdownBar"><span style="width:' + pct + '%"></span></div>';
      root.appendChild(row);
    });
  }

  function buildPlatformCard(p, parentMode) {
    const b = document.createElement("button");
    b.className = "platformCard";
    b.style.setProperty("--brand", p.brand || "#52d6ff");
    b.innerHTML = '<div class="platformIcon">' + p.icon + '</div><div class="platformName">' + p.name + '</div><div class="platformDesc">' + p.desc + '</div><div class="platformStatus">' + (parentMode ? "PARENT GUIDE →" : (p.found ? "FOUND + FIX →" : "PRIVACY GUIDE →")) + "</div>";
    b.addEventListener("click", () => openGuide(p, parentMode, b));
    return b;
  }

  function populateHubs() {
    $("platformGrid").innerHTML = "";
    PLATFORMS.forEach((p) => $("platformGrid").appendChild(buildPlatformCard(p, false)));

    $("parentPlatformGrid").innerHTML = "";
    PARENT_PLATFORMS.forEach((p) => $("parentPlatformGrid").appendChild(buildPlatformCard(p, true)));

    $("deviceParentGrid").innerHTML = "";
    DEVICE_GUIDES.forEach((p) => $("deviceParentGrid").appendChild(buildPlatformCard(p, true)));
  }

  let currentGuide = null;
  let guideIndex = 0;
  let guidePlatform = null;

  function guideFor(p, parentMode) {
    if (p.device === "ios") return parentMode ? iosParent : iosPrivacy;
    if (p.device === "android") return parentMode ? androidParent : androidPrivacy;
    if (parentMode) return parentGuides[p.name] || fallbackGuide(p.name);
    return genericGuide[p.name] || fallbackGuide(p.name);
  }

  let activeDevicePortal = null;

  function openGuideDirect(p, parentMode, startIndex = 0) {
    guidePlatform = p;
    currentGuide = guideFor(p, parentMode);
    guideIndex = Math.max(0, Math.min(startIndex, currentGuide.length - 1));
    $("coachSlide").innerHTML = "";
    $("coachModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    renderGuideSlide();
  }

  function closeDevicePortal() {
    if (!activeDevicePortal) return;
    const { element, keyHandler } = activeDevicePortal;
    if (keyHandler) window.removeEventListener("keydown", keyHandler);
    element.classList.add("portalClosing");
    setTimeout(() => element.remove(), 280);
    activeDevicePortal = null;
    currentGuide = null;
    guidePlatform = null;
    document.body.style.overflow = "";
  }

  function openDevicePortal(p, parentMode, originEl) {
    if (activeDevicePortal) closeDevicePortal();

    guidePlatform = p;
    const portalGuide = guideFor(p, parentMode);
    currentGuide = null;
    guideIndex = 0;

    const rect = originEl?.getBoundingClientRect();
    const portal = document.createElement("div");
    portal.className = "devicePortal " + (p.device === "ios" ? "iosPortal" : "androidPortal");
    portal.style.setProperty("--brand", p.brand || "#52d6ff");

    const isIOS = p.device === "ios";
    const deviceName = isIOS ? "iPhone" : "Android";
    const portalTargetLabel = isIOS ? "Settings" : (parentMode ? "Family Link" : "Settings");
    const appTiles = isIOS
      ? [
          ["✉","Messages"],["◉","Camera"],["▧","Photos"],["⌖","Find My"],
          ["◷","Clock"],["☁","Weather"],["♪","Music"],["⚙","Settings"]
        ]
      : [
          ["G","Google"],["◉","Camera"],["▧","Photos"],["▶","YouTube"],
          ["⌖","Maps"],["✉","Messages"],["◆","Family Link"],["⚙","Settings"]
        ];

    portal.innerHTML =
      '<div class="devicePortalBackdrop"></div>' +
      '<div class="devicePortalHud">' +
        '<div class="devicePortalKicker">' + (parentMode ? "FAMILY SAFETY CONTROLS" : "PRIVACY CONTROLS") + '</div>' +
        '<h2>Enter the ' + deviceName + '</h2>' +
        '<p>Click ' + portalTargetLabel + ' or scroll down to move inside the phone.</p>' +
      '</div>' +
      '<div class="devicePortalPhone">' +
        '<div class="portalPhoneNotch"></div>' +
        '<div class="portalPhoneStatus"><span>9:41</span><span>● ● ●</span></div>' +
        '<div class="portalHomeScreen">' +
          '<div class="portalWallpaperGlow"></div>' +
          '<div class="portalAppGrid">' +
            appTiles.map(([icon,label]) =>
              '<button type="button" class="portalApp ' + (label === portalTargetLabel ? "portalSettingsApp" : "") + '" aria-label="' + label + '">' +
                '<span>' + icon + '</span><small>' + label + '</small>' +
              '</button>'
            ).join("") +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="portalInstruction"><span class="portalMouse">↕</span><strong>SCROLL TO ENTER ' + portalTargetLabel.toUpperCase() + '</strong><small>or click the glowing ' + portalTargetLabel + ' icon</small></div>' +
      '<div class="portalFlash"></div>';

    const phone = portal.querySelector(".devicePortalPhone");
    if (rect) {
      phone.style.left = (rect.left + rect.width / 2) + "px";
      phone.style.top = (rect.top + rect.height / 2) + "px";
    }

    document.body.appendChild(portal);
    document.body.style.overflow = "hidden";
    activeDevicePortal = { element:portal, keyHandler:null };

    requestAnimationFrame(() => portal.classList.add("active"));

    let entering = false;
    const enterSettings = () => {
      if (entering) return;
      entering = true;
      portal.classList.add("entering");
      setTimeout(() => {
        const keyHandler = activeDevicePortal?.keyHandler;
        if (keyHandler) window.removeEventListener("keydown", keyHandler);
        portal.remove();
        activeDevicePortal = null;
        // The portal already performed the "open Settings" action.
        openGuideDirect(p, parentMode, Math.min(1, portalGuide.length - 1));
      }, 760);
    };

    portal.querySelector(".portalSettingsApp")?.addEventListener("click", (e) => {
      e.stopPropagation();
      enterSettings();
    });

    portal.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) < 18) return;
      e.preventDefault();
      if (e.deltaY > 0) enterSettings();
      else closeDevicePortal();
    }, { passive:false });

    const keyHandler = (e) => {
      if (!activeDevicePortal) return;
      if (["ArrowRight","ArrowDown","PageDown"," ","Enter"].includes(e.key)) {
        e.preventDefault();
        enterSettings();
      } else if (["Escape","ArrowLeft","ArrowUp"].includes(e.key)) {
        e.preventDefault();
        closeDevicePortal();
      }
    };
    activeDevicePortal.keyHandler = keyHandler;
    window.addEventListener("keydown", keyHandler);
  }

  let activeAppPortal = null;

  function closeAppPortal() {
    if (!activeAppPortal) return;
    const { element, keyHandler } = activeAppPortal;
    if (keyHandler) window.removeEventListener("keydown", keyHandler);
    element.classList.add("portalClosing");
    setTimeout(() => element.remove(), 260);
    activeAppPortal = null;
    document.body.style.overflow = "";
  }

  function openAppPortal(p, parentMode, originEl) {
    if (activeAppPortal) closeAppPortal();

    const rect = originEl?.getBoundingClientRect();
    const portal = document.createElement("div");
    portal.className = "appPortal";
    portal.style.setProperty("--brand", p.brand || "#52d6ff");

    portal.innerHTML =
      '<div class="appPortalBackdrop"></div>' +
      '<div class="appPortalHud">' +
        '<div class="devicePortalKicker">' + (parentMode ? "PARENT SAFETY GUIDE" : "PRIVACY GUIDE") + '</div>' +
        '<h2>Enter ' + p.name + '</h2>' +
        '<p>Scroll down or click the app icon to open its privacy controls.</p>' +
      '</div>' +
      '<button type="button" class="appPortalCore" aria-label="Open ' + p.name + '">' +
        '<span class="appPortalRing ringA"></span>' +
        '<span class="appPortalRing ringB"></span>' +
        '<span class="appPortalIcon">' + p.icon + '</span>' +
        '<strong>' + p.name + '</strong>' +
        '<small>' + (parentMode ? "SAFETY CONTROLS" : "PRIVACY CONTROLS") + '</small>' +
      '</button>' +
      '<div class="portalInstruction"><span class="portalMouse">↕</span><strong>SCROLL TO ENTER</strong><small>or click the glowing app icon</small></div>' +
      '<div class="portalFlash"></div>';

    const core = portal.querySelector(".appPortalCore");
    if (rect) {
      core.style.left = (rect.left + rect.width / 2) + "px";
      core.style.top = (rect.top + rect.height / 2) + "px";
    }

    document.body.appendChild(portal);
    document.body.style.overflow = "hidden";
    activeAppPortal = { element:portal, keyHandler:null };
    requestAnimationFrame(() => portal.classList.add("active"));

    let entering = false;
    const enter = () => {
      if (entering) return;
      entering = true;
      portal.classList.add("entering");
      setTimeout(() => {
        const keyHandler = activeAppPortal?.keyHandler;
        if (keyHandler) window.removeEventListener("keydown", keyHandler);
        portal.remove();
        activeAppPortal = null;
        openGuideDirect(p, parentMode, 0);
      }, 650);
    };

    core.addEventListener("click", enter);
    portal.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) < 18) return;
      e.preventDefault();
      if (e.deltaY > 0) enter();
      else closeAppPortal();
    }, { passive:false });

    const keyHandler = (e) => {
      if (!activeAppPortal) return;
      if (["ArrowRight","ArrowDown","PageDown"," ","Enter"].includes(e.key)) {
        e.preventDefault();
        enter();
      } else if (["Escape","ArrowLeft","ArrowUp"].includes(e.key)) {
        e.preventDefault();
        closeAppPortal();
      }
    };
    activeAppPortal.keyHandler = keyHandler;
    window.addEventListener("keydown", keyHandler);
  }

  function openGuide(p, parentMode, originEl = null) {
    if (p.device) {
      openDevicePortal(p, parentMode, originEl);
      return;
    }
    openAppPortal(p, parentMode, originEl);
  }

  function closeGuide() {
    $("coachModal").classList.add("hidden");
    document.body.style.overflow = "";
    currentGuide = null;
    $("coachSlide").innerHTML = "";
  }

  function iosRowsFor(target) {
    const screenTimeRows = ["Apps & Websites","Allowed Contacts","Time Allowances","Screen Time Schedules","Content & Privacy Restrictions","Communication Safety"];
    const privacyRows = ["Location Services","Tracking","Contacts","Calendars","Photos","Bluetooth","Local Network","Microphone","Camera"];

    if (target === "Family") return ["Airplane Mode","Wi-Fi","Bluetooth","Cellular","Notifications","Sounds & Haptics","Family","Screen Time","General","Privacy & Security"];
    if (target === "Child") return ["Family Checklist","Subscriptions","Purchase Sharing","Location Sharing","Child","Parents / Guardians"];
    if (target === "Screen Time") return ["Personal Information","Purchases","Subscriptions","Location Sharing","Screen Time"];
    if (screenTimeRows.includes(target)) return screenTimeRows;
    if (target === "Privacy & Security") return ["General","Accessibility","Action Button","Camera","Control Centre","Apps","Privacy & Security"];
    if (privacyRows.includes(target)) return privacyRows;
    if (target === "Precise Location") return ["Never","Ask Next Time Or When I Share","While Using the App","Always","Precise Location"];
    if (target === "Settings") return ["Messages","Camera","Photos","Find My","Clock","Weather","Music","Settings"];
    return ["Family","Screen Time","Privacy & Security","Notifications","General","Apps"];
  }

  function deviceRowsFor(target) {
    if (guidePlatform?.device === "ios") return iosRowsFor(target);
    if (guidePlatform?.device === "android") {
      if (target === "Family Link") return ["Google","Security & privacy","Digital Wellbeing","Family Link","Apps","Location"];
      return ["Controls","Daily limit","Downtime","App limits","Content restrictions","Location","Account settings"];
    }
    return null;
  }

  function phoneHeaderFor(target) {
    if (guidePlatform?.device === "ios") {
      const screenTimeTargets = ["Apps & Websites","Allowed Contacts","Time Allowances","Screen Time Schedules","Content & Privacy Restrictions","Communication Safety"];
      const privacyTargets = ["Location Services","Tracking","Contacts","Calendars","Photos","Bluetooth","Local Network","Microphone","Camera","Precise Location"];
      if (screenTimeTargets.includes(target)) return "Screen Time";
      if (privacyTargets.includes(target)) return target === "Precise Location" ? "Location Services" : "Privacy & Security";
      if (target === "Child" || target === "Screen Time") return "Family";
      return "Settings";
    }
    return guidePlatform?.name || "Privacy Guide";
  }

  function phoneSceneHtml(title, target, explanation) {
    if (explanation) {
      return '<div class="phoneScreen phoneTeachingScreen">' +
        '<div class="phoneTitle"><span class="phoneTitleIcon">' + (guidePlatform?.device ? "⚙" : guidePlatform.icon) + '</span><span>' + (guidePlatform?.device ? phoneHeaderFor(title) : guidePlatform.name) + '</span></div>' +
        '<div class="settingSuccess">' +
          '<div class="settingSuccessIcon">✓</div>' +
          '<div class="settingSuccessKicker">SETTING REVIEWED</div>' +
          '<strong>' + title + '</strong>' +
          '<span>Pause here and explain what this control changes.</span>' +
        '</div>' +
      '</div>';
    }

    const deviceRows = deviceRowsFor(target);
    const rows = deviceRows || ["Account","Privacy","Safety","Discoverability","Location","Messages","Content controls"];
    if (!deviceRows && target && target !== "EXPLAIN") {
      const i = Math.abs(hashCode(target)) % rows.length;
      rows[i] = target;
    }
    if (deviceRows && target && target !== "EXPLAIN" && !rows.includes(target)) rows.push(target);

    const phoneIcon = guidePlatform?.device ? "⚙" : guidePlatform.icon;
    const phoneHeader = guidePlatform?.device ? phoneHeaderFor(target) : guidePlatform.name;

    let html = '<div class="phoneScreen">' +
      '<div class="phoneTitle"><span class="phoneTitleIcon">' + phoneIcon + '</span><span>' + phoneHeader + '</span></div>' +
      '<div class="phoneCurrentScreen">' + title + '</div>' +
      '<div class="phoneRows">';

    rows.forEach((r) => {
      const isTarget = target !== "EXPLAIN" && r === target;
      html += '<div class="phoneRow' + (isTarget ? " target" : "") + '"><span>' + r + '</span>' +
        (isTarget ? '<span class="toggle on"></span>' : '<span>›</span>') +
        '</div>';
    });

    html += '</div></div>';
    return html;
  }

  function hashCode(str) {
    let h = 0;
    for (let i=0;i<str.length;i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return h;
  }

  let coachTransitionLocked = false;

  function ensureCoachStructure() {
    const slide = $("coachSlide");
    if (slide.querySelector(".phoneViewport")) return;

    slide.innerHTML =
      '<div class="coachVisual">' +
        '<div class="phoneMock phoneFixed" style="--brand:' + (guidePlatform.brand || "#52d6ff") + '">' +
          '<div class="phoneNotch"></div>' +
          '<div class="phoneStatus"><span>9:41</span><span>● ● ●</span></div>' +
          '<div class="phoneViewport"></div>' +
        '</div>' +
      '</div>' +
      '<div class="coachCopy"></div>';
  }

  function updateCoachCopy(title, body, target, isExplain, direction = 0) {
    const copy = $("coachSlide").querySelector(".coachCopy");
    const bullets = isExplain
      ? ["What this control changes","What exposure or risk it reduces","What the child/user will notice","Any trade-off or limitation to understand"]
      : ["Follow this exact path on the device","The highlighted row is the next tap","Use the presentation clicker to advance one action at a time"];

    const html =
      '<div class="eyebrow">' + (isExplain ? "WHY THIS SETTING MATTERS" : "STEP " + (guideIndex + 1)) + '</div>' +
      "<h2>" + title + "</h2><p>" + body + "</p>" +
      (isExplain
        ? '<div class="explainBox"><strong>What to explain to the audience</strong><ul>' + bullets.map((b)=>"<li>"+b+"</li>").join("") + "</ul></div>"
        : '<div class="tapCallout"><strong>Next action:</strong>&nbsp; ' + target + "</div>");

    if (!direction) {
      copy.innerHTML = html;
      return;
    }

    copy.classList.remove("copySwapForward","copySwapBack");
    void copy.offsetWidth;
    copy.classList.add(direction > 0 ? "copySwapForward" : "copySwapBack");
    setTimeout(() => { copy.innerHTML = html; }, 120);
    setTimeout(() => copy.classList.remove("copySwapForward","copySwapBack"), 390);
  }

  function updatePhoneScene(title, target, isExplain, direction = 0) {
    ensureCoachStructure();
    const viewport = $("coachSlide").querySelector(".phoneViewport");
    const newScene = document.createElement("div");
    newScene.className = "phoneScene";
    newScene.innerHTML = phoneSceneHtml(title,target,isExplain);

    const oldScene = viewport.querySelector(".phoneScene");
    if (!oldScene || !direction) {
      viewport.replaceChildren(newScene);
      return;
    }

    newScene.classList.add(direction > 0 ? "phoneSceneIncomingRight" : "phoneSceneIncomingLeft");
    viewport.appendChild(newScene);

    requestAnimationFrame(() => {
      oldScene.classList.add(direction > 0 ? "phoneSceneExitLeft" : "phoneSceneExitRight");
      newScene.classList.remove(direction > 0 ? "phoneSceneIncomingRight" : "phoneSceneIncomingLeft");
      newScene.classList.add("phoneSceneActive");
    });

    setTimeout(() => {
      if (oldScene.isConnected) oldScene.remove();
      newScene.classList.remove("phoneSceneActive");
    }, 430);
  }

  function renderGuideSlide(direction = 0) {
    if (!currentGuide) return;
    ensureCoachStructure();

    const step = currentGuide[guideIndex];
    const title = step[0], body = step[1], target = step[2];
    const isExplain = target === "EXPLAIN";

    const phone = $("coachSlide").querySelector(".phoneMock");
    phone.style.setProperty("--brand", guidePlatform.brand || "#52d6ff");

    $("coachBrand").textContent = guidePlatform.name + (guidePlatform.device ? " Parent Guide" : " Privacy Guide");
    $("coachCounter").textContent = (guideIndex + 1) + " / " + currentGuide.length;
    $("coachOfficial").href = officialHelp(guidePlatform.name, guidePlatform.device);
    $("coachProgress").innerHTML = '<span class="coachProgressBar" style="width:' + Math.round((guideIndex+1)/currentGuide.length*100) + '%"></span>';

    updatePhoneScene(title,target,isExplain,direction);
    updateCoachCopy(title,body,target,isExplain,direction);

    $("coachPrev").disabled = guideIndex === 0;
    $("coachNext").textContent = guideIndex === currentGuide.length - 1 ? "Finish guide" : "Next";
  }

  function navigateGuide(delta) {
    if (!currentGuide || coachTransitionLocked) return;

    if (delta > 0 && guideIndex >= currentGuide.length - 1) {
      const deck = document.querySelector(".coachDeck");
      if (deck) deck.classList.add("coachZoomOut");
      coachTransitionLocked = true;
      setTimeout(() => {
        if (deck) deck.classList.remove("coachZoomOut");
        closeGuide();
        coachTransitionLocked = false;
      }, 320);
      return;
    }

    const next = Math.max(0, Math.min(currentGuide.length - 1, guideIndex + delta));
    if (next === guideIndex) return;

    coachTransitionLocked = true;
    const target = $("coachSlide").querySelector(".phoneRow.target");

    if (target && delta > 0) {
      target.classList.add("tapActivated");
      const ripple = document.createElement("span");
      ripple.className = "tapRipple";
      target.appendChild(ripple);
    }

    setTimeout(() => {
      guideIndex = next;
      renderGuideSlide(delta);
    }, target && delta > 0 ? 175 : 40);

    setTimeout(() => {
      coachTransitionLocked = false;
    }, target && delta > 0 ? 630 : 510);
  }

  function officialHelp(name, device) {
    if (device === "ios" && name === "iPhone Privacy") return "https://support.apple.com/guide/iphone/control-access-to-information-in-apps-iph251e92810/ios";
    if (device === "android" && name === "Android Privacy") return "https://support.google.com/android/answer/9431959";
    if (device === "ios") return "https://support.apple.com/families";
    if (device === "android") return "https://families.google/familylink/";
    const map = {
      "Instagram":"https://help.instagram.com/",
      "Facebook":"https://www.facebook.com/help/",
      "TikTok":"https://support.tiktok.com/",
      "LinkedIn":"https://www.linkedin.com/help/linkedin",
      "Reddit":"https://support.reddithelp.com/",
      "Snapchat":"https://help.snapchat.com/",
      "Discord":"https://support.discord.com/",
      "YouTube":"https://support.google.com/youtube/",
      "X / Twitter":"https://help.x.com/",
      "WhatsApp":"https://faq.whatsapp.com/",
      "Telegram":"https://telegram.org/faq",
      "Twitch":"https://help.twitch.tv/",
      "Strava":"https://support.strava.com/",
      "GitHub":"https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings",
      "Pinterest":"https://help.pinterest.com/"
    };
    return map[name] || "https://www.google.com/search?q=" + encodeURIComponent(name + " privacy settings");
  }

  consent.addEventListener("change", setConsentState);

  if (liveSearchBtn) {
    liveSearchBtn.addEventListener("click", async () => {
      if (!consent.checked) return;

      const firstName = $("firstName").value.trim();
      const lastName = $("lastName").value.trim();
      const age = $("age").value.trim();
      const city = $("city").value.trim();
      const username = $("username").value.trim();
      const clues = $("clues") ? $("clues").value.trim() : "";

      if (!firstName || !lastName) {
        alert("Enter a first and last name before running the live search.");
        return;
      }

      eraseNotice.classList.add("hidden");
      results.classList.add("hidden");
      scanPanel.classList.remove("hidden");
      liveSearchBtn.disabled = true;

      const statuses = [
        ["Searching the public internet…","Checking open web results without using age as a hard filter."],
        ["Checking public profiles…","Looking for name, city, username and platform matches."],
        ["Comparing identity clues…","Age is only a soft supporting signal, not a requirement."],
        ["Checking news and organization pages…","Looking for public bios, events, media and professional references."],
        ["Verifying source links…","Only sourced results will be shown."]
      ];
      let statusIndex = 0;
      scanTitle.textContent = statuses[0][0];
      scanSub.textContent = statuses[0][1];
      const timer = setInterval(() => {
        statusIndex = (statusIndex + 1) % statuses.length;
        scanTitle.textContent = statuses[statusIndex][0];
        scanSub.textContent = statuses[statusIndex][1];
      }, 900);

      try {
        const res = await fetch("/.netlify/functions/live-search", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            consent:true,
            firstName,
            lastName,
            age,
            city,
            username,
            clues
          }),
          cache:"no-store"
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data.error || "Live search failed.") + (data.detail ? " " + data.detail : ""));
        }

        renderReport(data);
      } catch (e) {
        alert(e.message);
      } finally {
        clearInterval(timer);
        scanPanel.classList.add("hidden");
        setConsentState();
      }
    });
  }

  if (syntheticDemoBtn) {
    syntheticDemoBtn.addEventListener("click", () => {
      if (!consent.checked) return;

      eraseNotice.classList.add("hidden");
      results.classList.add("hidden");
      scanPanel.classList.remove("hidden");
      syntheticDemoBtn.disabled = true;

      const statuses = [
        ["Building synthetic demonstration…","Generating clearly labelled sample findings."],
        ["Creating sample account links…","No public internet search is being performed."],
        ["Generating sample exposure…","All counts and examples are fabricated for teaching."],
        ["Preparing presentation…","Synthetic mode will remain visibly marked on every result."]
      ];
      let i = 0;
      scanTitle.textContent = statuses[0][0];
      scanSub.textContent = statuses[0][1];
      const timer = setInterval(() => {
        i = (i + 1) % statuses.length;
        scanTitle.textContent = statuses[i][0];
        scanSub.textContent = statuses[i][1];
      }, 550);

      setTimeout(() => {
        clearInterval(timer);
        scanPanel.classList.add("hidden");
        renderReport(syntheticReport());
        setConsentState();
      }, 2200);
    });
  }

  fileInput.addEventListener("change", async () => {
    if (!consent.checked || !fileInput.files[0]) return;
    eraseNotice.classList.add("hidden");
    const file = fileInput.files[0];
    let evidence;
    try { evidence = JSON.parse(await file.text()); }
    catch (e) { alert("That file is not valid JSON."); return; }

    scanSequence(async () => {
      try {
        const res = await fetch("/.netlify/functions/summarize", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ consent:true, evidence }),
          cache:"no-store"
        });
        if (!res.ok) throw new Error("summarizer");
        const data = await res.json();
        data.dataMode = "evidence";
        data.synthetic = false;
        renderReport(data);
      } catch (e) {
        results.classList.add("hidden");
        alert("Evidence analysis failed. No synthetic results were substituted. Please check the evidence file or try again.");
      }
    });
  });

  eraseBtn.addEventListener("click", () => {
    results.classList.add("hidden");
    scanPanel.classList.add("hidden");
    ["firstName","lastName","age","city","username","clues"].forEach((id) => { if ($(id)) $(id).value = ""; });
    consent.checked = false;
    fileInput.value = "";
    setConsentState();
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    document.querySelectorAll("iframe").forEach((el) => el.remove());
    eraseNotice.classList.remove("hidden");
    window.scrollTo({top:0,behavior:"smooth"});
  });

  $("coachClose").addEventListener("click", closeGuide);
  document.querySelector("[data-close-coach]").addEventListener("click", closeGuide);
  $("coachPrev").addEventListener("click", () => navigateGuide(-1));
  $("coachNext").addEventListener("click", () => navigateGuide(1));

  let coachWheelLocked = false;

  $("coachSlide").addEventListener("click", (e) => {
    if (!currentGuide) return;
    if (e.target.closest(".phoneRow.target")) navigateGuide(1);
  });

  $("coachModal").addEventListener("wheel", (e) => {
    if (!currentGuide || $("coachModal").classList.contains("hidden")) return;
    if (Math.abs(e.deltaY) < 20 || coachWheelLocked) return;
    e.preventDefault();
    coachWheelLocked = true;
    navigateGuide(e.deltaY > 0 ? 1 : -1);
    setTimeout(() => { coachWheelLocked = false; }, 620);
  }, { passive:false });

  window.addEventListener("keydown", (e) => {
    if (!currentGuide) return;
    if (["ArrowRight","PageDown"," ","Enter"].includes(e.key)) {
      e.preventDefault();
      $("coachNext").click();
    } else if (["ArrowLeft","PageUp","Backspace"].includes(e.key)) {
      e.preventDefault();
      $("coachPrev").click();
    } else if (e.key === "Escape") {
      closeGuide();
    }
  });

  populateHubs();
  setConsentState();
  checkLiveSearchReady();
})();