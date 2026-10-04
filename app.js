(() => {
  try {
    const resetKey = "pfLastHardReset";
    const last = Number(localStorage.getItem(resetKey) || 0);
    const now = Date.now();
    if (!last || now - last >= 24 * 60 * 60 * 1000) {
      sessionStorage.clear();
      localStorage.removeItem("pfPhotoPresenter");
      localStorage.setItem(resetKey, String(now));
    }
  } catch {}


  "use strict";

  const $ = (id) => document.getElementById(id);
  const MIN_LIVE_SEARCH_MS = 14000;
  const wait = (ms) => new Promise(resolve => setTimeout(resolve,ms));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);

  const consent = $("consent");
  const consentBox = $("consentBox");
  const liveSearchBtn = $("liveSearchBtn");
  const syntheticDemoBtn = $("syntheticDemoBtn");
  const privacyGuidesBtn = $("privacyGuidesBtn");
  const uploadLabel = $("uploadLabel");
  const fileInput = $("fileInput");
  const scanPanel = $("scanPanel");
  const scanTitle = $("scanTitle");
  const scanSub = $("scanSub");
  const results = $("results");
  const eraseBtn = $("eraseBtn");
  const eraseNotice = $("eraseNotice");
  const reportStageNames = ["Snapshot","Sources","What it means","Exposure","App privacy","Phone privacy","Parent controls","Child device controls","Takeaway"];
  let reportStageIndex = 0;
  let privacyGuideDirectMode = false;

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

  const APPLE_LOGO_SVG = '<svg class="brandLogoSvg appleLogoSvg" viewBox="0 0 64 64" aria-hidden="true"><path fill="#111827" d="M41.7 13.2c3.5-4.2 3.1-8.1 3-9.2-3.1.2-6.8 2.1-8.8 4.5-2.2 2.5-3.5 5.6-3.2 8.8 3.4.3 6.5-1.5 9-4.1zM49.8 34.1c-.1-8.1 6.6-12 6.9-12.2-3.8-5.5-9.7-6.3-11.8-6.4-5-.5-9.8 3-12.3 3-2.5 0-6.4-3-10.5-2.9-5.4.1-10.4 3.1-13.2 7.8-5.6 9.7-1.4 24.1 4 31.9 2.7 3.8 5.8 8.1 9.9 7.9 4-.2 5.5-2.6 10.3-2.6s6.2 2.6 10.4 2.5c4.3-.1 7-3.8 9.6-7.7 3.1-4.5 4.4-8.9 4.5-9.1-.1 0-8.7-3.3-8.8-13.2z"/></svg>';
  const ANDROID_LOGO_SVG = '<svg class="brandLogoSvg androidLogoSvg" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M22 15 17 8M42 15l5-7"/></g><g fill="#fff"><path d="M17 20h30a5 5 0 0 1 5 5v18H12V25a5 5 0 0 1 5-5z"/><rect x="18" y="40" width="7" height="17" rx="3.5"/><rect x="39" y="40" width="7" height="17" rx="3.5"/><rect x="7" y="25" width="7" height="20" rx="3.5"/><rect x="50" y="25" width="7" height="20" rx="3.5"/></g><circle cx="23" cy="28" r="2.2" fill="#72d572"/><circle cx="41" cy="28" r="2.2" fill="#72d572"/></svg>';

  const PLATFORMS = [
    {name:"iPhone Privacy",icon:APPLE_LOGO_SVG,brand:"#e7edf3",desc:"Location, precise location, contacts, photos, camera, microphone, tracking and app permissions",found:true,device:"ios"},
    {name:"Android Privacy",icon:ANDROID_LOGO_SVG,brand:"#72d572",desc:"Permission manager, location, precise location, camera, microphone, contacts, photos and app access",found:true,device:"android"},
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
    {name:"iPhone / iPad",icon:APPLE_LOGO_SVG,brand:"#e7edf3",desc:"Screen Time, Communication Safety, app installs, contacts, web content, privacy, location, purchases and downtime",device:"ios"},
    {name:"Android / Family Link",icon:ANDROID_LOGO_SVG,brand:"#72d572",desc:"Family Link, app approvals, location, Chrome, Search, YouTube, contacts, purchases, limits and bedtime",device:"android"}
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
      ["Location permission","At the phone level, review Instagram's location permission and use While Using or Never unless a feature genuinely needs it.","Location"],
      ["Why this matters","Contact uploads and device permissions can make your account easier to discover and can expose more context than your profile alone.","EXPLAIN"]
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
      ["Phone location permission","Open the phone's app permissions for WhatsApp and review Location access.","Location"],
      ["Why this matters","WhatsApp can expose presence, profile imagery, group connections and live location. Live Location is shared only to chats you choose; device permission controls whether WhatsApp can access location at all.","EXPLAIN"]
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
    ["Open Settings","Open the Settings app on the iPhone.","Settings"],
    ["Open Privacy & Security","Scroll down and tap Privacy & Security.","Privacy & Security"],
    ["Location Services","Tap Location Services to see every app that has requested location access.","Location Services"],
    ["Precise Location","Inside an app's Location Services screen, review Precise Location.","Precise Location"],
    ["Tracking","Go back to Privacy & Security and tap Tracking.","Tracking"],
    ["Contacts","Go back to Privacy & Security and tap Contacts.","Contacts"],
    ["Photos","Go back to Privacy & Security and tap Photos.","Photos"],
    ["Camera","Go back to Privacy & Security and tap Camera.","Camera"],
    ["Microphone","Go back to Privacy & Security and tap Microphone.","Microphone"],
    ["Local Network","Go back to Privacy & Security and tap Local Network.","Local Network"],
    ["Safety Check","Go back to Privacy & Security and tap Safety Check.","Safety Check"]
  ];

  const androidPrivacy = [
    ["Open Settings","Open Settings on the Android device.","Settings"],
    ["Open Security & privacy","Tap Security & privacy. Wording can vary slightly by manufacturer.","Security & privacy"],
    ["Open Permission manager","Open Privacy, then Permission manager.","Privacy controls"],
    ["Location","Tap Location to review every app with location permission.","Location"],
    ["Precise location","Tap an app under Location and review Use precise location.","Precise location"],
    ["Camera","Go back to Permission manager and tap Camera.","Camera"],
    ["Microphone","Go back to Permission manager and tap Microphone.","Microphone"],
    ["Photos and videos","Go back to Permission manager and tap Photos and videos.","Photos and videos"],
    ["Contacts","Go back to Permission manager and tap Contacts.","Contacts"],
    ["Unused apps","Open an app's permissions and review Pause app activity if unused.","Unused apps"],
    ["Privacy dashboard","Go back to Privacy and tap Privacy dashboard to review recent sensitive access.","Privacy dashboard"]
  ];

  const iosParent = [
    ["Open Settings","On the parent's iPhone, open Settings.","Settings"],
    ["Open Family","Tap Family.","Family"],
    ["Select your child","Tap the child's name in the Family group.","Child"],
    ["Open Screen Time","Tap Screen Time to open the child's current parental-control settings.","Screen Time"],
    ["Apps & Websites","Review which apps and websites the child can access.","Apps & Websites"],
    ["Ask to Buy","Inside Apps & Websites restrictions, require approval for eligible new app purchases and downloads.","Ask to Buy"],
    ["Ask to Browse","Review website filtering and Ask to Browse so new websites can require parent approval.","Ask to Browse"],
    ["Allowed Contacts","Choose who the child can communicate with in supported Phone, Messages and FaceTime experiences, including approval for new contacts.","Allowed Contacts"],
    ["Always Allowed","Choose essential apps and contacts that remain available even when other Screen Time limits are active.","Always Allowed"],
    ["Time Allowances","Set daily time budgets for categories such as entertainment, games and social media.","Time Allowances"],
    ["Screen Time Schedules","Create school, after-school, evening or weekend routines for when apps can be used.","Screen Time Schedules"],
    ["Content & Privacy Restrictions","Open Content & Privacy Restrictions to manage age ratings, built-in features and sensitive settings.","Content & Privacy Restrictions"],
    ["App Store purchases","Review installing apps, deleting apps and in-app purchase restrictions.","iTunes & App Store Purchases"],
    ["Age-appropriate content","Review App Store, Media, Web & Games restrictions and age ratings.","App Store, Media, Web & Games"],
    ["Allow changes to settings","Review whether the child can change Accounts, Contacts, Photos, Location Services and other protected settings.","Allow Changes to Settings"],
    ["Communication Safety","Open Communication Safety and review the protection for the child account.","Communication Safety"],
    ["What Communication Safety does","On supported Apple services, on-device detection can warn and blur sensitive photos or videos before they are viewed or sent. Apple does not receive the image merely because sensitive content was detected.","EXPLAIN"],
    ["Extra protection for younger children","With a Screen Time passcode, younger child accounts can require parent or guardian approval before viewing certain detected sensitive content. This is not a system that simply forwards the child's image to the parent.","EXPLAIN"],
    ["Open Privacy & Security","On the child's iPhone, return to Settings and open Privacy & Security.","Privacy & Security"],
    ["Location Services","Open Location Services and review which apps can use the child's location.","Location Services"],
    ["Precise Location","For apps that only need a general area, turn off Precise Location where appropriate.","Precise Location"],
    ["Contacts","Return to Privacy & Security and review which apps can access Contacts.","Contacts"],
    ["Photos","Review Photos access and use limited-library access where a full photo library is not required.","Photos"],
    ["Finish with the child","Review the most-used apps together and explain why each protection exists. The goal is safer habits, not just locked settings.","EXPLAIN"]
  ];

  const androidParent = [
    ["Open Family Link","Open Google Family Link on the parent's device.","Family Link"],
    ["Select the child","Choose the child's profile.","Child profile"],
    ["Screen time","Open Screen time to review limits and schedules.","Screen time"],
    ["Daily limit","Open Time limits and set the daily device limit.","Daily limit"],
    ["Downtime / schedule","Set school-night or bedtime downtime and any schedule that fits the family.","Downtime"],
    ["App limits","Under Screen time → Time limits → App limits, set individual app limits, block apps or allow unlimited-time apps.","App limits"],
    ["Google Play controls","Open Controls and review Google Play restrictions.","Google Play"],
    ["App and download approvals","Require approval for eligible app downloads where appropriate.","App approvals"],
    ["Purchase approvals","Choose which Google Play purchases or downloads require parent approval.","Purchases"],
    ["Chrome and Web","Open Controls → Google Chrome and Web.","Chrome"],
    ["Website controls","Choose Allow all sites, Try to block explicit sites, or Only allow approved sites, and review approved/blocked sites.","Websites"],
    ["Google Search","Review SafeSearch and Search settings available for the supervised account.","SafeSearch"],
    ["YouTube","Review the supervised YouTube experience and content settings for the child.","YouTube"],
    ["Contacts, calls & text","Open Controls → Contacts, calls & text. Review parent-managed contacts and who the child may call or text on supported apps/devices.","Contacts"],
    ["Location sharing","Open Family Link's Location tab and review whether the parent's device can see the child's supported Android device location.","Device location"],
    ["Location settings","Review Location settings and Location Accuracy when appropriate.","Precise location"],
    ["App permissions","Review sensitive app permissions such as location, camera, microphone, contacts, photos and videos. Where supported, set permission changes to require the parent.","App permissions"],
    ["Unknown apps / sideloading","Keep installation from unknown sources off unless there is a specific reason to allow it.","Unknown apps"],
    ["Account privacy settings","Open Controls → Account settings → Privacy settings and review the child's Google activity and account privacy choices.","Account supervision"],
    ["Family Link notifications","Review notifications for app requests, website requests, activity-control changes and location changes.","Parent alerts"],
    ["Why it matters","Family Link combines screen-time limits, app approval, web and search controls, approved contacts, location and app-permission review in one parent dashboard. Exact options vary by Android version and device.","EXPLAIN"]
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
      presentation:{
        photos:[],
        quotes:[
          {platform:"Instagram",text:"Great weekend away with friends.",confidence:"synthetic"},
          {platform:"Reddit",text:"Looking for recommendations for my next trip.",confidence:"synthetic"},
          {platform:"LinkedIn",text:"Proud to be part of another community event.",confidence:"synthetic"}
        ],
        themes:[
          {term:"Travel",count:5},{term:"Community",count:4},{term:"Sports",count:3},
          {term:"Restaurants",count:3},{term:"Technology",count:2},{term:"Events",count:2}
        ]
      },
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
      const res = await fetch("/.netlify/functions/health", { cache:"no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.liveSearchConfigured) {
        status.classList.add("liveConfigured");
        status.classList.remove("liveUnconfigured");
        status.innerHTML = '<span class="statusDot"></span><strong>Live Search ready.</strong>';
        liveSearchBtn.dataset.configured = "true";
        setConsentState();
      } else {
        status.classList.add("liveUnconfigured");
        status.classList.remove("liveConfigured");
        status.innerHTML = '<span class="statusDot"></span><strong>Live Search unavailable.</strong>';
        liveSearchBtn.dataset.configured = "false";
        setConsentState();
      }
    } catch (e) {
      status.classList.add("liveUnconfigured");
      status.innerHTML = '<span class="statusDot"></span><strong>Live Search status unavailable.</strong>';
      liveSearchBtn.dataset.configured = "unknown";
      setConsentState();
    }
  }

  const scanPositions = [
    [5,8,-7],[73,4,5],[82,57,-4],[7,60,6],[58,70,-2],[28,4,4],[68,32,7],[18,34,-5]
  ];
  const quotePositions = [
    [4,25,-2],[68,18,2],[63,72,-1],[9,75,1],[39,8,-2],[36,74,2]
  ];

  function clearCinematicScan(){
    ["scanPhotoLayer","scanQuoteLayer","scanWordCloud","scanPlatformNodes"].forEach(id=>{
      const el=$(id); if(el) el.replaceChildren();
    });
    const count=$("scanDiscoveryCount"); if(count) count.textContent="0";
    const progress=$("scanProgressValue"); if(progress) progress.textContent="0%";
    const orb=$("scanProgressOrb"); if(orb) orb.style.setProperty("--scan-progress","0deg");
    const label=$("scanStageLabel"); if(label) label.textContent="Initializing search";
  }

  function setCinematicProgress(value,label){
    const pct=Math.max(0,Math.min(100,Math.round(value)));
    const progress=$("scanProgressValue");
    if(progress) progress.textContent=pct+"%";
    const orb=$("scanProgressOrb");
    if(orb) orb.style.setProperty("--scan-progress",(pct*3.6)+"deg");
    const stage=$("scanStageLabel");
    if(stage&&label) stage.textContent=label;
  }

  function startCinematicScan(subject){
    clearCinematicScan();
    const target=$("scanTargetName");
    if(target) target.textContent=(subject||"SEARCH SUBJECT").toUpperCase();
    const meta=$("scanTargetMeta");
    if(meta) meta.textContent="Public/indexed sources only • sensitive values masked";
    setCinematicProgress(4,"Opening public search");
  }

  function hydrateCinematicScan(report){
    const presentation=report?.presentation||{};
    const photos=Array.isArray(presentation.photos)?presentation.photos.slice(0,8):[];
    const quotes=Array.isArray(presentation.quotes)?presentation.quotes.slice(0,6):[];
    const themes=Array.isArray(presentation.themes)?presentation.themes.slice(0,12):[];
    const sources=Array.isArray(report?.publicSources)?report.publicSources:[];

    const photoLayer=$("scanPhotoLayer");
    if(photoLayer){
      photoLayer.replaceChildren();
      photos.forEach((photo,index)=>{
        if(!photo?.src)return;
        const card=document.createElement("figure");
        card.className="scanFloatPhoto";
        const [x,y,r]=scanPositions[index%scanPositions.length];
        card.style.setProperty("--x",x+"%");
        card.style.setProperty("--y",y+"%");
        card.style.setProperty("--r",r+"deg");
        card.style.setProperty("--delay",(index*.16)+"s");
        const img=document.createElement("img");
        img.src=photo.src;
        img.alt="";
        img.loading="eager";
        img.referrerPolicy="no-referrer";
        img.addEventListener("error",()=>card.remove(),{once:true});
        const cap=document.createElement("figcaption");
        cap.textContent=photo.platform||photo.domain||"Public image";
        card.append(img,cap);
        photoLayer.appendChild(card);
      });
    }

    const quoteLayer=$("scanQuoteLayer");
    if(quoteLayer){
      quoteLayer.replaceChildren();
      quotes.forEach((quote,index)=>{
        if(!quote?.text)return;
        const card=document.createElement("div");
        card.className="scanQuoteCard";
        const [x,y,r]=quotePositions[index%quotePositions.length];
        card.style.setProperty("--x",x+"%");
        card.style.setProperty("--y",y+"%");
        card.style.setProperty("--r",r+"deg");
        card.style.setProperty("--delay",(index*.22+.25)+"s");
        const platform=document.createElement("strong");
        platform.textContent=quote.platform||quote.domain||"Public source";
        const textEl=document.createElement("span");
        textEl.textContent="“"+quote.text+"”";
        card.append(platform,textEl);
        quoteLayer.appendChild(card);
      });
    }

    const cloud=$("scanWordCloud");
    if(cloud){
      cloud.replaceChildren();
      themes.forEach((theme,index)=>{
        const term=typeof theme==="string"?theme:theme.term;
        const count=typeof theme==="object"?Number(theme.count)||1:1;
        if(!term)return;
        const span=document.createElement("span");
        span.textContent=term;
        span.style.setProperty("--scale",String(Math.min(1.65,1+count*.11)));
        span.style.setProperty("--delay",(index*.09+.5)+"s");
        cloud.appendChild(span);
      });
    }

    const platformNodes=$("scanPlatformNodes");
    if(platformNodes){
      platformNodes.replaceChildren();
      const platformNames=[...new Set(sources.map(s=>s.platform).filter(Boolean))].slice(0,8);
      platformNames.forEach((name,index)=>{
        const node=document.createElement("span");
        node.className="scanPlatformNode";
        node.textContent=name;
        node.style.setProperty("--i",String(index));
        node.style.setProperty("--total",String(Math.max(platformNames.length,1)));
        platformNodes.appendChild(node);
      });
    }

    const discoveries=photos.length+quotes.length+themes.length+sources.length;
    const countEl=$("scanDiscoveryCount");
    if(countEl) countEl.textContent=String(discoveries);
  }

  function renderPublicVoice(report,modeClass){
    const panel=$("publicVoicePanel");
    const quoteGrid=$("resultQuoteGrid");
    const wordCloud=$("resultWordCloud");
    if(!panel||!quoteGrid||!wordCloud)return;
    const presentation=report?.presentation||{};
    const quotes=Array.isArray(presentation.quotes)?presentation.quotes:[];
    const themes=Array.isArray(presentation.themes)?presentation.themes:[];

    panel.classList.toggle("hidden",!quotes.length&&!themes.length);
    quoteGrid.replaceChildren();
    wordCloud.replaceChildren();

    quotes.slice(0,8).forEach(q=>{
      const card=document.createElement("blockquote");
      card.className="resultQuoteCard";
      const textEl=document.createElement("p");
      textEl.textContent="“"+String(q.text||"")+"”";
      const cite=document.createElement("cite");
      cite.textContent=modeClass==="synthetic"
        ? ((q.platform||"Example source")+" • SYNTHETIC EXAMPLE")
        : ((q.platform||q.domain||"Public source")+" • "+(q.confidence==="strong"?"strong match":"possible match"));
      card.append(textEl,cite);
      quoteGrid.appendChild(card);
    });

    themes.slice(0,14).forEach(item=>{
      const term=typeof item==="string"?item:item.term;
      const count=typeof item==="object"?Number(item.count)||1:1;
      if(!term)return;
      const chip=document.createElement("span");
      chip.className="resultThemeWord "+modeClass;
      chip.textContent=term;
      chip.style.fontSize=(.72+Math.min(.55,count*.06))+"rem";
      wordCloud.appendChild(chip);
    });
  }

  function renderIntelligence(report,modeClass){
    const panel=$("profileStoryPanel");
    if(!panel)return;
    const intel=report?.intelligence;
    const usable=!!(intel && (intel.overview || (intel.storyPoints||[]).length || (intel.timeline||[]).length));
    panel.classList.toggle("hidden",!usable);
    if(!usable)return;

    $("intelligenceHeadline").textContent=intel.headline || "What the fragments say together";
    $("intelligenceOverview").textContent=intel.overview || "";
    $("intelligenceCaveat").textContent=intel.caveat || "";

    const badge=$("intelligenceMode");
    if(badge) badge.textContent=intel.aiUsed ? "AI SYNTHESIS • SOURCED" : "SOURCED FALLBACK";

    const grid=$("storyPointGrid");
    grid.replaceChildren();
    (intel.storyPoints||[]).slice(0,5).forEach(point=>{
      const card=document.createElement("article");
      card.className="storyPointCard";
      const title=document.createElement("strong");
      title.textContent=point.title || "Connected finding";
      const summary=document.createElement("p");
      summary.textContent=point.summary || "";
      const meta=document.createElement("div");
      meta.className="storyPointMeta";
      const confidence=document.createElement("span");
      confidence.textContent=String(point.confidence||"possible").toUpperCase();
      const anchors=document.createElement("span");
      const count=Array.isArray(point.evidenceIds)?point.evidenceIds.length:0;
      anchors.textContent=count ? (count+" SOURCE ANCHOR"+(count===1?"":"S")) : "HIGH-LEVEL SYNTHESIS";
      meta.append(confidence,anchors);
      card.append(title,summary,meta);
      grid.appendChild(card);
    });

    const timelineWrap=$("intelligenceTimelineWrap");
    const timeline=$("intelligenceTimeline");
    const items=(intel.timeline||[]).slice(0,5);
    timelineWrap.classList.toggle("hidden",!items.length);
    timeline.replaceChildren();
    items.forEach(item=>{
      const row=document.createElement("article");
      row.className="intelligenceTimelineItem";
      const period=document.createElement("div");
      period.className="timelinePeriod";
      period.textContent=item.period || "Broad period";
      const copy=document.createElement("div");
      const summary=document.createElement("p");
      summary.textContent=item.summary || "";
      const confidence=document.createElement("span");
      confidence.className="timelineConfidence";
      confidence.textContent=String(item.confidence||"possible").toUpperCase();
      copy.append(summary,confidence);
      row.append(period,copy);
      timeline.appendChild(row);
    });
  }

  function broadMapUrl(place){
    const center=place?.mapCenter;
    const lat=Number(center?.lat),lon=Number(center?.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return "";
    const radiusKm=Math.max(45,Number(center?.radiusKm)||50);
    const dlat=(radiusKm*1.35)/111.32;
    const cos=Math.max(Math.cos(lat*Math.PI/180),.2);
    const dlon=(radiusKm*1.35)/(111.32*cos);
    const bbox=[lon-dlon,lat-dlat,lon+dlon,lat+dlat].map(n=>n.toFixed(4)).join("%2C");
    return "https://www.openstreetmap.org/export/embed.html?bbox="+bbox+"&layer=mapnik";
  }

  function renderLocationIntelligence(report){
    const panel=$("mapPanel");
    const grid=$("mapGrid");
    if(!panel||!grid)return;
    const locations=Array.isArray(report?.locationIntelligence?.storyLocations)
      ? report.locationIntelligence.storyLocations.slice(0,4)
      : [];
    panel.classList.toggle("hidden",!locations.length);
    grid.replaceChildren();
    locations.forEach(location=>{
      const card=document.createElement("article");
      card.className="mapCard";
      const map=broadMapUrl(location);
      if(map){
        const viewport=document.createElement("div");
        viewport.className="mapViewport";
        const frame=document.createElement("iframe");
        frame.src=map;
        frame.loading="lazy";
        frame.referrerPolicy="no-referrer";
        frame.title="Broad map for "+String(location.label||"location");
        viewport.appendChild(frame);
        card.appendChild(viewport);
      }
      const meta=document.createElement("div");
      meta.className="mapMeta";
      const title=document.createElement("strong");
      title.textContent=location.label || location.requestedLabel || "Broad location";
      const context=document.createElement("p");
      context.textContent=location.context || "Broad geographic context supported by public evidence.";
      const confidence=document.createElement("span");
      confidence.className="timelineConfidence";
      confidence.textContent=String(location.confidence||"possible").toUpperCase()+" • CITY/REGION ONLY";
      meta.append(title,context,confidence);
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }

  function updatePlatformGuideHits(report){
    const found=new Set((report?.publicSources||[]).map(source=>source.platform).filter(Boolean));
    document.querySelectorAll("#platformGrid .platformCard").forEach(card=>{
      const name=card.querySelector(".platformName")?.textContent||"";
      const status=card.querySelector(".platformStatus");
      if(!status||/Privacy$/.test(name))return;
      const hit=found.has(name);
      card.classList.toggle("foundInSearch",hit);
      status.textContent=hit?"FOUND IN LIVE SEARCH • FIX →":"PRIVACY GUIDE →";
    });
  }

function setConsentState() {
    const ok = !!consent.checked;
    if (liveSearchBtn) liveSearchBtn.disabled = !ok || liveSearchBtn.dataset.configured === "false";
    if (syntheticDemoBtn) syntheticDemoBtn.disabled = !ok;
    fileInput.disabled = !ok;
    uploadLabel.classList.toggle("disabled", !ok);
    uploadLabel.setAttribute("aria-disabled", ok ? "false" : "true");
    consentBox.classList.toggle("approved", ok);
  }

  function scanSequence(done) {
    const steps = [
      ["Building synthetic demonstration…","No live public findings are being used in this fallback."],
      ["Staging example platforms…","Creating clearly labelled synthetic platform nodes."],
      ["Staging example images…","Synthetic blurred tiles demonstrate the visual search experience."],
      ["Staging example excerpts…","Synthetic phrases demonstrate how public text can accumulate."],
      ["Building the synthetic report…","Every result remains visibly labelled SYNTHETIC."]
    ];
    results.classList.add("hidden");
    scanPanel.classList.remove("hidden");
    startCinematicScan("SYNTHETIC DEMO");
    const syntheticPresentation={
      publicSources:[
        {platform:"Instagram"},{platform:"LinkedIn"},{platform:"Reddit"},{platform:"YouTube"}
      ],
      presentation:{
        photos:[],
        quotes:[
          {platform:"Instagram",text:"Great weekend away with friends.",confidence:"possible"},
          {platform:"Reddit",text:"Looking for recommendations for my next trip.",confidence:"possible"},
          {platform:"LinkedIn",text:"Proud to be part of another community event.",confidence:"possible"}
        ],
        themes:[
          {term:"travel",count:5},{term:"community",count:4},{term:"sports",count:3},
          {term:"restaurants",count:3},{term:"technology",count:2},{term:"events",count:2}
        ]
      }
    };
    hydrateCinematicScan(syntheticPresentation);
    let i = 0;
    scanTitle.textContent = steps[0][0];
    scanSub.textContent = steps[0][1];
    const started=Date.now();
    const timer = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(timer);
        setCinematicProgress(100,"Synthetic report ready");
        setTimeout(() => {
          scanPanel.classList.add("hidden");
          clearCinematicScan();
          done();
        }, 420);
        return;
      }
      scanTitle.textContent = steps[i][0];
      scanSub.textContent = steps[i][1];
      setCinematicProgress(Math.min(92,18+i*18),steps[i][0].replace("…",""));
    }, 650);
  }

  function reportStages() {
    return [...document.querySelectorAll("[data-report-stage]")];
  }

  function showReportStage(index) {
    const stages = reportStages();
    if (!stages.length) return;
    reportStageIndex = Math.max(0, Math.min(index, stages.length - 1));
    stages.forEach((stage,i) => stage.classList.toggle("hidden", i !== reportStageIndex));

    document.querySelectorAll("[data-report-target]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.reportTarget) === reportStageIndex);
    });

    if ($("reportStageCounter")) $("reportStageCounter").textContent = (reportStageIndex + 1) + " / " + stages.length;
    if ($("reportStageName")) $("reportStageName").textContent = reportStageNames[reportStageIndex] || "Section";
    if ($("reportPrev")) $("reportPrev").disabled = reportStageIndex === 0;
    if ($("reportNext")) $("reportNext").textContent = reportStageIndex === stages.length - 1 ? "Finish" : "Next →";

    const viewport = $("reportStageViewport");
    if (viewport) viewport.scrollTop = 0;
    stages[reportStageIndex]?.scrollTo?.({top:0,behavior:"instant"});
  }

  function openReportDeck(report) {
    if ($("reportDeckSubject")) $("reportDeckSubject").textContent = report?.subject || "Presentation results";
    document.body.classList.add("reportDeckActive");
    results.classList.remove("hidden");
    showReportStage(0);
  }

  function closeReportDeck() {
    results.classList.add("hidden");
    document.body.classList.remove("reportDeckActive","privacyGuideDirect");
    reportStageIndex = 0;
    const wasDirect=privacyGuideDirectMode;
    privacyGuideDirectMode = false;
    if ($("closeReportDeck")) $("closeReportDeck").textContent = "Exit results";
    if (wasDirect && window.location.hash === "#privacy-settings") {
      history.replaceState(null,"",window.location.pathname + window.location.search);
    }
  }

  function resetPlatformGuideHitsForDirectMode() {
    document.querySelectorAll("#platformGrid .platformCard").forEach(card=>{
      card.classList.remove("foundInSearch");
      const status=card.querySelector(".platformStatus");
      if(status)status.textContent="PRIVACY GUIDE →";
    });
  }

  function openPrivacyGuideHub(fromHash = false) {
    privacyGuideDirectMode = true;
    document.body.classList.add("reportDeckActive","privacyGuideDirect");
    resetPlatformGuideHitsForDirectMode();
    if ($("reportDeckSubject")) $("reportDeckSubject").textContent = "Privacy Settings Guide";
    if ($("closeReportDeck")) $("closeReportDeck").textContent = "← Back to home";
    results.classList.remove("hidden");
    showReportStage(4);
    const viewport=$("reportStageViewport");
    if(viewport) viewport.scrollTop=0;
    window.scrollTo(0,0);
    if (!fromHash && window.location.hash !== "#privacy-settings") {
      history.pushState(null,"","#privacy-settings");
    }
  }

  function renderReport(report) {
    const mode = report.dataMode === "verified" ? "verified" : report.dataMode === "synthetic" ? "synthetic" : "evidence";
    const banner = $("dataModeBanner");
    const modeLabel = mode === "verified" ? "LIVE PUBLIC" : mode === "synthetic" ? "SYNTHETIC" : "EVIDENCE FILE";
    const modeClass = mode;

    if (banner) {
      banner.className = "dataModeBanner " + modeClass;
      if (mode === "verified") {
        banner.innerHTML = "<strong>LIVE PUBLIC SEARCH RESULTS</strong><span>These are real public/indexed pages returned for the supplied identifiers. Strong and possible labels describe match confidence, not proof of identity.</span>";
      } else if (mode === "synthetic") {
        banner.innerHTML = "<strong>SYNTHETIC DEMONSTRATION DATA</strong><span>Everything on this result screen is fabricated to demonstrate what the presentation can look like. Nothing here was found about the person entered.</span>";
      } else {
        banner.innerHTML = "<strong>USER-SUPPLIED EVIDENCE</strong><span>This report summarizes the JSON file you uploaded. It has not been independently verified by this app as a live public-source search.</span>";
      }
    }

    $("subjectName").textContent = report.subject || "Search Subject";
    $("summaryLine").textContent = mode === "verified"
      ? (report.intelligence?.overview || ("Verified public-source findings, privacy-masked before display." +
          (report.searchHealth?.failed
            ? " " + report.searchHealth.completed + " of " + report.searchHealth.attempted + " search passes completed."
            : "")))
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

      const sourceGroups = new Map();
      publicSources.forEach((source) => {
        const label = source.platform || source.domain || "Public web";
        const key = String(label).toLowerCase();
        if (!sourceGroups.has(key)) {
          sourceGroups.set(key, {
            label,
            sources:[],
            reasons:new Set(),
            domains:new Set(),
            strong:0,
            possible:0
          });
        }
        const group = sourceGroups.get(key);
        group.sources.push(source);
        (source.reasons || []).forEach(reason => group.reasons.add(reason));
        if (source.domain) group.domains.add(source.domain);
        if (source.confidence === "strong") group.strong += 1;
        else group.possible += 1;
      });

      [...sourceGroups.values()]
        .sort((a,b) => {
          if (!!a.strong !== !!b.strong) return a.strong ? -1 : 1;
          if (a.sources.length !== b.sources.length) return b.sources.length - a.sources.length;
          return a.label.localeCompare(b.label);
        })
        .forEach((group) => {
          const card = document.createElement("article");
          const bestConfidence = group.strong ? "strong" : "possible";
          const total = group.sources.length;
          const reasons = [...group.reasons].slice(0,4).join(" • ");
          const domains = [...group.domains].slice(0,3).join(" • ");

          card.className = "publicSourceCard publicSourceGroup " + (group.strong ? "strongMatch" : "possibleMatch");
          card.innerHTML =
            '<div class="publicSourceTop">' +
              '<span class="publicSourcePlatform">' + escapeHtml(group.label) + '</span>' +
              '<span class="sourceGroupCount">' + total + (total === 1 ? " RESULT" : " RESULTS") + '</span>' +
              '<span class="matchConfidence ' + bestConfidence + '">' +
                (group.strong ? "STRONGEST: STRONG" : "POSSIBLE MATCHES") +
              '</span>' +
            '</div>' +
            '<strong>' + total + (total === 1 ? " public result" : " public results") + ' from ' + escapeHtml(group.label) + '</strong>' +
            '<p>Repeated results from this source are grouped together. Expand the list only when you want to inspect the individual public pages.</p>' +
            '<div class="publicSourceMeta">' +
              '<span>' + escapeHtml(domains || group.label) + '</span>' +
              '<span>' + escapeHtml(reasons || "name match") + '</span>' +
            '</div>' +
            '<div class="sourceGroupStats">' +
              (group.strong ? '<span class="strongStat">' + group.strong + ' strong</span>' : '') +
              (group.possible ? '<span>' + group.possible + ' possible</span>' : '') +
            '</div>';

          const details = document.createElement("details");
          details.className = "publicSourceDetails";
          const summary = document.createElement("summary");
          summary.textContent = "VIEW " + total + (total === 1 ? " SOURCE LINK" : " SOURCE LINKS");
          details.appendChild(summary);

          const links = document.createElement("div");
          links.className = "publicSourceLinks";
          group.sources
            .slice()
            .sort((a,b) => {
              if (a.confidence !== b.confidence) return a.confidence === "strong" ? -1 : 1;
              return String(a.domain || "").localeCompare(String(b.domain || ""));
            })
            .forEach((source,index) => {
              const link = document.createElement("a");
              link.className = "publicSourceLink";
              link.href = source.url;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              const sourceReasons = (source.reasons || []).join(" • ") || "name match";
              const handle = source.handleMasked ? " • " + source.handleMasked : "";
              link.innerHTML =
                '<span><b>' + escapeHtml(source.domain || group.label) + '</b><small>' +
                  escapeHtml(sourceReasons + handle) +
                '</small></span>' +
                '<em class="' + (source.confidence === "strong" ? "strong" : "possible") + '">' +
                  (source.confidence === "strong" ? "STRONG" : "POSSIBLE") +
                '</em><i>↗</i>';
              link.setAttribute("aria-label", group.label + " source " + (index + 1) + " opens in a new tab");
              links.appendChild(link);
            });
          details.appendChild(links);
          card.appendChild(details);
          publicSourcesGrid.appendChild(card);
        });
    }

    renderIntelligence(report,modeClass);
    renderPublicVoice(report,modeClass);
    renderLocationIntelligence(report);
    updatePlatformGuideHits(report);

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
      $("imageTotal").textContent = (report.imageBreakdown || []).reduce((sum,x)=>sum+Number(x[1]||0),0);
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

    const zeroFallback = $("zeroResultFallback");
    if (zeroFallback) {
      const verifiedHitCount = mode === "verified"
        ? (report.publicSources || []).length
        : 1;
      zeroFallback.classList.toggle("hidden", !(mode === "verified" && verifiedHitCount === 0));
    }

    $("takeaway").textContent = mode === "synthetic"
      ? "Synthetic mode is a visual fallback only. Use it to demonstrate capabilities when a live search returns little or nothing. Do not present these values as findings."
      : "One post is a fragment. Hundreds of verified or supplied fragments can become a profile. Always check the provenance label and source before treating a value as a real finding.";
    openReportDeck(report);
  }

  function renderBreakdown(id, items) {
    const root = $(id);
    root.innerHTML = "";
    const max = Math.max(1, ...items.map((x) => Number(x[1] || 0)));
    items.forEach((x) => {
      const row = document.createElement("div");
      row.className = "breakdownRow";
      const pct = Math.max(5, Math.round(Number(x[1]) / max * 100));
      row.innerHTML = "<span>" + escapeHtml(x[0]) + "</span><strong>" + escapeHtml(x[1]) + '</strong><div class="breakdownBar"><span style="width:' + pct + '%"></span></div>';
      root.appendChild(row);
    });
  }

  function buildPlatformCard(p, parentMode) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "platformCard" + (p.device ? " devicePrivacyCard" : "");
    b.style.setProperty("--brand", p.brand || "#52d6ff");
    const status = parentMode
      ? (p.device ? "ENTER PARENT CONTROLS →" : "PARENT GUIDE →")
      : (p.device ? "ENTER DEVICE →" : "PRIVACY GUIDE →");
    b.innerHTML = '<div class="platformIcon">' + p.icon + '</div><div class="platformName">' + p.name + '</div><div class="platformDesc">' + p.desc + '</div><div class="platformStatus">' + status + "</div>";
    b.addEventListener("click", () => openGuide(p, parentMode, b));
    return b;
  }

  function populateHubs() {
    $("platformGrid").innerHTML = "";
    PLATFORMS.filter((p) => !p.device).forEach((p) => $("platformGrid").appendChild(buildPlatformCard(p, false)));

    const privacyDevices = $("devicePrivacyGrid");
    if (privacyDevices) {
      privacyDevices.innerHTML = "";
      PLATFORMS.filter((p) => p.device).forEach((p) => privacyDevices.appendChild(buildPlatformCard(p, false)));
    }

    const directPrivacyDevices = $("directDevicePrivacyGrid");
    if (directPrivacyDevices) {
      directPrivacyDevices.innerHTML = "";
      PLATFORMS.filter((p) => p.device).forEach((p) => directPrivacyDevices.appendChild(buildPlatformCard(p, false)));
    }

    $("parentPlatformGrid").innerHTML = "";
    PARENT_PLATFORMS.forEach((p) => $("parentPlatformGrid").appendChild(buildPlatformCard(p, true)));

    $("deviceParentGrid").innerHTML = "";
    DEVICE_GUIDES.forEach((p) => $("deviceParentGrid").appendChild(buildPlatformCard(p, true)));
  }

  let currentGuide = null;
  let guideIndex = 0;
  let guidePlatform = null;

  function guideFor(p, parentMode) {
    if (p.device === "ios") return parentMode ? iosParent : expandDevicePrivacyGuide(p,iosPrivacy);
    if (p.device === "android") return parentMode ? androidParent : expandDevicePrivacyGuide(p,androidPrivacy);
    if (parentMode) return parentGuides[p.name] || fallbackGuide(p.name);

    // Social-app walkthroughs are expanded into true click-by-click navigation.
    // Before every actual privacy-control screen, show the parent menu again with
    // the exact next row highlighted. This lets a presenter lead a non-technical
    // audience tap-for-tap instead of jumping between settings.
    const base=(genericGuide[p.name] || fallbackGuide(p.name))
      .filter(step=>step[2]!=="EXPLAIN")
      .map(step=>step.slice());

    const alreadyHasNotifications=base.some(step=>step[2]==="Notifications");
    if(!alreadyHasNotifications){
      base.push([
        "Notification privacy",
        "At the phone level, review this app's notification permission, lock-screen visibility and preview settings.",
        "Notifications"
      ]);
    }

    const expanded=[];
    let previousWasDetail=false;
    for(const step of base){
      const target=String(step[2]||"");
      const detail=settingDetailFor(p.name,target);
      if(detail){
        const menuName=platformHeaderFor(p.name,target);
        expanded.push([
          previousWasDetail ? "Go back, then tap " + step[0] : "Tap " + step[0],
          previousWasDetail
            ? "Tap Back once to return to " + menuName + ". Then tap " + step[0] + "."
            : "From " + menuName + ", tap " + step[0] + ".",
          "NAV:" + target
        ]);
        expanded.push(step);
        previousWasDetail=true;
      }else{
        expanded.push(step);
        previousWasDetail=false;
      }
    }
    return expanded;
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
    const screenTimeRows = ["Apps & Websites","Allowed Contacts","Always Allowed","Time Allowances","Screen Time Schedules","Content & Privacy Restrictions","Communication Safety"];
    const privacyRows = ["Location Services","Tracking","Contacts","Calendars","Photos","Bluetooth","Local Network","Microphone","Camera","Safety Check"];

    if (target === "Family") return ["Airplane Mode","Wi-Fi","Bluetooth","Cellular","Notifications","Sounds & Haptics","Family","Screen Time","General","Privacy & Security"];
    if (target === "Child") return ["Family Checklist","Subscriptions","Purchase Sharing","Location Sharing","Child","Parents / Guardians"];
    if (target === "Screen Time") return ["Personal Information","Purchases","Subscriptions","Location Sharing","Screen Time"];
    if (["Ask to Buy","Ask to Browse"].includes(target)) return ["Apps & Websites","Restrictions","Ask to Buy","Websites","Ask to Browse","Allowed","Blocked"];
    if (["iTunes & App Store Purchases","App Store, Media, Web & Games","Allow Changes to Settings"].includes(target)) {
      return ["Content & Privacy Restrictions","iTunes & App Store Purchases","App Store, Media, Web & Games","Other Features","Allow Changes to Settings"];
    }
    if (screenTimeRows.includes(target)) return screenTimeRows;
    if (target === "Privacy & Security") return ["General","Accessibility","Action Button","Camera","Control Centre","Apps","Privacy & Security"];
    if (privacyRows.includes(target)) return privacyRows;
    if (target === "Precise Location") return ["Never","Ask Next Time Or When I Share","While Using the App","Always","Precise Location"];
    if (target === "Settings") return ["Messages","Camera","Photos","Find My","Clock","Weather","Music","Settings"];
    return ["Family","Screen Time","Privacy & Security","Notifications","General","Apps"];
  }

  function androidRowsFor(target) {
    const ensureTarget = (rows) => {
      const out = rows.slice();
      if (target && target !== "EXPLAIN" && !out.includes(target)) {
        out.splice(Math.min(2, out.length), 0, target);
      }
      return out.slice(0, 9);
    };

    const personal = guidePlatform?.name === "Android Privacy";
    if (!personal) {
      if (target === "Family Link") return ensureTarget(["Google","Security & privacy","Digital Wellbeing","Family Link","Apps","Location"]);
      if (target === "Child profile") return ensureTarget(["Family","Child profile","Screen time","Controls","Location","Highlights"]);
      if (["Screen time","Daily limit","Downtime","App limits"].includes(target)) return ensureTarget(["Screen time","Time limits","Daily limit","Downtime","School time","App limits","Bonus time"]);
      if (["Google Play","App approvals","Purchases"].includes(target)) return ensureTarget(["Controls","Google Play","Purchase & download approvals","App approvals","Content restrictions","Purchases"]);
      if (["Chrome","Websites"].includes(target)) return ensureTarget(["Google Chrome","Try to block explicit sites","Only allow approved sites","Manage sites","Blocked sites"]);
      if (target === "SafeSearch") return ensureTarget(["Google Search","SafeSearch","Personal results","Search settings"]);
      if (target === "YouTube") return ensureTarget(["YouTube","Content settings","YouTube Kids","Search","Watch history","Autoplay"]);
      if (target === "Contacts") return ensureTarget(["Controls","Contacts, calls & text","Parent-managed contacts","Allowed calls & texts","Contact requests"]);
      if (["Device location","Precise location"].includes(target)) return ensureTarget(["Location","Device location","Location accuracy","Location permissions","Precise location"]);
      if (target === "App permissions") return ensureTarget(["App permissions","Location","Camera","Microphone","Contacts","Photos and videos"]);
      if (target === "Unknown apps") return ensureTarget(["Apps","App limits","Blocked apps","Unknown apps","App permissions"]);
      if (["Account supervision","Parent alerts"].includes(target)) return ensureTarget(["Account settings","Account supervision","Parent alerts","Privacy settings","Sign-in controls"]);
      return ensureTarget(["Controls","Daily limit","Downtime","App limits","Content restrictions","Location","Account settings"]);
    }

    const permissionRows = ["Location","Camera","Microphone","Photos and videos","Contacts","Nearby devices","Notifications"];
    if (target === "Settings") return ensureTarget(["Network & internet","Connected devices","Apps","Notifications","Battery","Storage","Security & privacy","Location"]);
    if (target === "Security & privacy") return ensureTarget(["App security","Device unlock","Account security","System & updates","Privacy","More security & privacy"]);
    if (target === "Privacy controls") return ensureTarget(["Privacy dashboard","Permission manager","Show passwords","Notifications on lock screen","Ads","Health Connect"]);
    if (permissionRows.includes(target) || target === "Precise location") return ensureTarget(permissionRows);
    if (target === "Unused apps") return ensureTarget(["Permission manager","Unused apps","Privacy dashboard","Ads"]);
    if (target === "Privacy dashboard") return ensureTarget(["Location","Camera","Microphone","Other permissions","See other permissions"]);
    return ensureTarget(["Security & privacy","Privacy dashboard","Permission manager","Location","Apps"]);
  }

  function deviceRowsFor(target) {
    if (guidePlatform?.device === "ios") return iosRowsFor(target);
    if (guidePlatform?.device === "android") return androidRowsFor(target);
    return null;
  }

  function phoneHeaderFor(target) {
    if (guidePlatform?.device === "ios") {
      const screenTimeTargets = ["Apps & Websites","Allowed Contacts","Time Allowances","Screen Time Schedules","Content & Privacy Restrictions","Communication Safety"];
      const privacyTargets = ["Location Services","Tracking","Contacts","Calendars","Photos","Bluetooth","Local Network","Microphone","Camera","Precise Location","Safety Check"];
      if (screenTimeTargets.includes(target)) return "Screen Time";
      if (privacyTargets.includes(target)) return target === "Precise Location" ? "Location Services" : "Privacy & Security";
      if (target === "Child" || target === "Screen Time") return "Family";
      return "Settings";
    }
    if (guidePlatform?.device === "android") {
      if (guidePlatform?.name === "Android / Family Link") {
        if (["Screen time","Daily limit","Downtime","App limits"].includes(target)) return "Screen time";
        if (["Google Play","App approvals","Purchases"].includes(target)) return "Google Play";
        if (["Chrome","Websites"].includes(target)) return "Google Chrome";
        if (target === "SafeSearch") return "Google Search";
        if (target === "YouTube") return "YouTube";
        if (target === "Contacts") return "Contacts, calls & text";
        if (["Device location","Precise location"].includes(target)) return "Location";
        if (target === "App permissions") return "App permissions";
        if (target === "Unknown apps") return "Apps";
        if (["Account supervision","Parent alerts"].includes(target)) return "Account settings";
        return "Family Link";
      }
      if (["Location","Camera","Microphone","Photos and videos","Contacts","Precise location"].includes(target)) return "Permission manager";
      if (["Privacy controls","Unused apps","Privacy dashboard"].includes(target)) return "Privacy";
      return target === "Security & privacy" ? "Settings" : "Security & privacy";
    }
    return guidePlatform?.name || "Privacy Guide";
  }

  function platformRowsFor(name, target) {
    const guide = genericGuide[name] || fallbackGuide(name);
    const controls = [];
    const seen = new Set();

    for (const step of guide) {
      const label = String(step?.[2] || "").trim();
      if (!label || label === "EXPLAIN" || seen.has(label)) continue;
      seen.add(label);
      controls.push(label);
    }

    if (!controls.length) return ["Profile","Settings","Privacy","Discoverability","Location","Messages"];

    const index = Math.max(0, controls.indexOf(target));
    const start = Math.max(0, Math.min(index - 2, Math.max(0, controls.length - 7)));
    const windowRows = controls.slice(start, start + 7);
    if (target && target !== "EXPLAIN" && !windowRows.includes(target)) {
      windowRows.splice(Math.min(2, windowRows.length), 0, target);
    }
    return windowRows.slice(0,7);
  }

  function platformHeaderFor(name, target) {
    const settingsTargets = /settings|privacy|visibility|discover|account|safety|security|controls|audience|messages|location|contacts|history|profile/i;
    if (settingsTargets.test(String(target || ""))) {
      if (/privacy|audience|discover|visibility|location|contacts/i.test(String(target || ""))) return "Privacy";
      return "Settings";
    }
    return name || "Privacy";
  }

  const DEVICE_SETTING_DETAILS = {
    ios:{
      "Location Services":{kind:"choices",section:"Location Services",options:["Never","Ask Next Time Or When I Share","While Using the App","Always"],recommended:"While Using or Never for most social apps",defaultText:"Apps have no location access until you grant permission.",why:"Location access can reveal where you are or support location-based features. Review each app individually instead of leaving broad access in place."},
      "Precise Location":{kind:"toggle",section:"App Location Access",label:"Precise Location",value:"Off",recommended:"Off unless the app genuinely needs your exact position",defaultText:"Precise Location is chosen per app after location permission is granted.",why:"Turning Precise Location off gives an app an approximate area instead of your specific location."},
      "Tracking":{kind:"toggle",section:"Tracking",label:"Allow Apps to Request to Track",value:"Off",recommended:"Off",defaultText:"Apps must request permission before tracking across other companies' apps and websites.",why:"Limiting tracking reduces cross-app advertising and profiling based on activity outside the app."},
      "Contacts":{kind:"toggles",section:"Contacts",items:[["Messaging / social apps","Off unless needed"],["Utilities","Off unless needed"],["Trusted communication apps","Review individually"]],recommended:"Allow only apps that genuinely need your address book",defaultText:"Apps cannot access Contacts until permission is granted.",why:"Contact access can expose names, phone numbers and email addresses and can help apps connect you to other users."},
      "Photos":{kind:"choices",section:"Photos",options:["None","Add Photos Only","Limited Access","Full Access"],recommended:"Limited Access where possible",defaultText:"Apps must request photo-library permission before access is granted.",why:"Full photo-library access can expose far more than the one image you intended to share, including screenshots and other personal media."},
      "Camera":{kind:"toggles",section:"Camera",items:[["Social apps","Review individually"],["Unused apps","Off"],["Apps that never take photos/video","Off"]],recommended:"Only apps that genuinely need the camera",defaultText:"Apps cannot use Camera until permission is granted.",why:"Camera permission allows an app to capture photos or video when you use camera features."},
      "Microphone":{kind:"toggles",section:"Microphone",items:[["Calling / recording apps","Review individually"],["Unused apps","Off"],["Apps that never record audio","Off"]],recommended:"Only apps that genuinely need the microphone",defaultText:"Apps cannot use Microphone until permission is granted.",why:"Microphone permission allows audio capture when the app uses recording or communication features."},
      "Local Network":{kind:"toggles",section:"Local Network",items:[["Casting / smart-home apps","Review individually"],["Social apps without a local-device feature","Off"],["Unused apps","Off"]],recommended:"Off unless the app needs to find devices on your Wi-Fi network",defaultText:"Apps must request Local Network permission.",why:"Local Network access lets an app discover or communicate with devices on the same network."},
      "Safety Check":{kind:"status",section:"Safety Check",status:"Emergency Reset or Manage Sharing & Access",recommended:"Use when you need to quickly review people, apps, devices and sharing",defaultText:"Safety Check is a review tool, not a permission that starts on or off.",why:"Safety Check can quickly review or stop sharing, reset app privacy permissions and review devices connected to your Apple Account."}
    },
    android:{
      "Location":{kind:"choices",section:"Location permission",options:["Allow all the time","Allow only while using the app","Ask every time","Don't allow"],recommended:"Allow only while using or Don't allow for most social apps",defaultText:"Apps have no location permission until you grant it.",why:"Location permission can expose your device's location. Background access is more permissive than while-in-use access."},
      "Precise location":{kind:"toggle",section:"Location permission",label:"Use precise location",value:"Off",recommended:"Off unless exact location is required",defaultText:"Precise versus approximate location is selected per app when location access is available.",why:"Turning precise location off lets the app use an approximate area instead of your exact position."},
      "Camera":{kind:"choices",section:"Camera permission",options:["Allow only while using the app","Ask every time","Don't allow"],recommended:"Ask every time or Don't allow if camera use is rare",defaultText:"Apps must request Camera permission.",why:"Camera permission lets the app capture photos or video when camera features are used."},
      "Microphone":{kind:"choices",section:"Microphone permission",options:["Allow only while using the app","Ask every time","Don't allow"],recommended:"Ask every time or Don't allow if microphone use is rare",defaultText:"Apps must request Microphone permission.",why:"Microphone permission lets the app record audio when microphone features are used."},
      "Photos and videos":{kind:"choices",section:"Photos and videos",options:["Select photos and videos","Allow all","Don't allow"],recommended:"Select photos and videos where supported",defaultText:"Apps must request media permission before access is granted.",why:"Selected-photo access limits an app to the media you choose instead of your entire library."},
      "Contacts":{kind:"choices",section:"Contacts permission",options:["Allow","Don't allow"],recommended:"Don't allow unless contact access is necessary",defaultText:"Apps must request Contacts permission.",why:"Contact access can expose names, phone numbers and email addresses and can help apps match you with other users."},
      "Unused apps":{kind:"toggle",section:"Unused app settings",label:"Pause app activity if unused",value:"On",recommended:"On",defaultText:"Android can automatically reset permissions for apps you stop using.",why:"Pausing unused apps reduces stale permissions that remain active long after you stopped using an app."},
      "Privacy dashboard":{kind:"status",section:"Privacy dashboard",status:"Review recent Location, Camera and Microphone access",recommended:"Check for access you do not recognize or no longer need",defaultText:"Privacy dashboard records recent permission use; it is a review screen rather than an on/off permission.",why:"The dashboard helps you spot which apps recently accessed sensitive permissions and then remove access you do not need."}
    }
  };

  function deviceSettingDetailFor(device,target){
    return DEVICE_SETTING_DETAILS[device]?.[target] || null;
  }

  function deviceDefaultSettingFor(device,target,detail){
    return detail?.defaultText || "Permission state depends on what you previously granted to each app.";
  }

  function deviceMenuNameFor(device,target){
    if(device==="ios"){
      if(target==="Precise Location") return "Location Services → choose an app";
      return "Privacy & Security";
    }
    if(device==="android"){
      if(target==="Precise location") return "Permission manager → Location → choose an app";
      if(target==="Unused apps") return "Apps → choose an app → Permissions";
      if(target==="Privacy dashboard") return "Security & privacy → Privacy";
      return "Permission manager";
    }
    return "Settings";
  }

  function expandDevicePrivacyGuide(p,source){
    const base=source.filter(step=>step[2]!=="EXPLAIN").map(step=>step.slice());
    const expanded=[];
    let previousWasDetail=false;
    for(const step of base){
      const target=String(step[2]||"");
      const detail=deviceSettingDetailFor(p.device,target);
      if(detail){
        const menu=deviceMenuNameFor(p.device,target);
        expanded.push([
          previousWasDetail ? "Go back, then tap " + step[0] : "Tap " + step[0],
          previousWasDetail
            ? "Tap Back until you return to " + menu + ". Then tap " + step[0] + "."
            : "From " + menu + ", tap " + step[0] + ".",
          "NAV:" + target
        ]);
        expanded.push(step);
        previousWasDetail=true;
      }else{
        expanded.push(step);
        previousWasDetail=false;
      }
    }
    return expanded;
  }

  const APP_SETTING_DETAILS = {
    "Instagram":{
      "Private account":{kind:"toggle",section:"Account privacy",label:"Private account",value:"On",recommended:"On",why:"Only approved followers can see future private-account posts. Existing followers remain until you remove them."},
      "Tags / Mentions":{kind:"choices",section:"Tags and mentions",options:["Allow tags from everyone","Allow tags from people you follow","Don't allow tags"],recommended:"People you follow / Don't allow",why:"Tags and mentions can publicly connect your account to other people, events and places."},
      "Message controls":{kind:"choices",section:"Messages and story replies",options:["Requests from everyone","People you follow","Don't receive requests"],recommended:"People you follow",why:"Restricting requests reduces unsolicited contact and the chance strangers can connect your account to other identities."},
      "Contact syncing":{kind:"toggle",section:"Follow and invite friends",label:"Connect contacts",value:"Off",recommended:"Off",why:"Contact syncing can make your account discoverable to people who already have your phone number or email."},
      "Location":{kind:"location",section:"Instagram location permission",recommended:"While Using or Never",why:"Location permission can let Instagram use device location for location-based features. Turning it off limits device-location access but does not remove locations you already added to posts."}
    },
    "Facebook":{
      "Audience":{kind:"choices",section:"Who can see what you share",options:["Public","Friends","Friends except…","Specific friends","Only me"],recommended:"Friends",why:"Audience controls decide who can see profile details, posts and stories. Public content can be indexed, reshared and linked over time."},
      "Future posts":{kind:"choices",section:"Future posts",options:["Public","Friends","Friends except…","Specific friends","Only me"],recommended:"Friends",why:"This sets the default audience for new posts. Choosing Friends reduces accidental public posting."},
      "How people find you":{kind:"choices",section:"How people find and contact you",options:["Everyone","Friends of friends","Friends"],recommended:"Friends of friends / Friends",why:"Tighter discovery settings reduce how easily strangers can connect your name to your account."},
      "Search engines":{kind:"toggle",section:"Search engines outside Facebook",label:"Allow search engines to link to your profile",value:"Off",recommended:"Off",why:"Turning this off reduces direct search-engine linking to your Facebook profile. It does not guarantee removal of pages already indexed elsewhere."},
      "Location":{kind:"location",section:"Facebook location permission",recommended:"While Using or Never",why:"Location permission can let Facebook use device location for location-aware features. Turning it off limits device-location access but does not erase locations already posted."}
    },
    "TikTok":{
      "Private account":{kind:"toggle",section:"Privacy",label:"Private account",value:"On",recommended:"On",why:"Only people you approve can follow you and view private-account content."},
      "Suggest account":{kind:"toggles",section:"Suggest your account to others",items:[["Contacts","Off"],["Facebook friends","Off"],["People who open/send links","Off"],["People with mutual connections","Off"]],recommended:"Turn off suggestions you do not need",why:"Suggestion controls can connect your account to contacts, friends and people who interact with links."},
      "Sync contacts":{kind:"toggle",section:"Sync contacts and Facebook friends",label:"Sync contacts",value:"Off",recommended:"Off",why:"Turning off syncing stops new contact uploads. Remove previously synced contacts separately where available."},
      "Downloads":{kind:"toggle",section:"Downloads",label:"Video downloads",value:"Off",recommended:"Off",why:"Disabling downloads makes it harder for other users to save clean copies of your videos through TikTok."},
      "Direct messages":{kind:"choices",section:"Direct messages",options:["Everyone","Suggested friends","Friends","No one"],recommended:"Friends / No one",why:"Restricting direct messages limits unsolicited contact."},
      "Location":{kind:"location",section:"TikTok location permission",recommended:"While Using or Never",why:"TikTok can use device location for location-based features and recommendations. Turning permission off limits device-location access."}
    },
    "LinkedIn":{
      "Public profile visibility":{kind:"toggle",section:"Edit your public profile",label:"Your profile's public visibility",value:"Off / limited",recommended:"Limit to what you intentionally want public",why:"Public-profile fields can appear in search-engine results outside LinkedIn."},
      "Email discovery":{kind:"choices",section:"Profile discovery using email",options:["Everyone on LinkedIn","2nd-degree connections","Nobody"],recommended:"Nobody / 2nd-degree",why:"Restricting email discovery makes it harder to connect a private email address to your professional profile."},
      "Phone discovery":{kind:"choices",section:"Profile discovery using phone",options:["Everyone on LinkedIn","2nd-degree connections","Nobody"],recommended:"Nobody / 2nd-degree",why:"Restricting phone discovery reduces account matching from your mobile number."},
      "Email visibility":{kind:"choices",section:"Who can see your email address",options:["Only visible to me","1st-degree connections","1st and 2nd-degree connections","Anyone on LinkedIn"],recommended:"Only visible to me",why:"Your email address can bridge your professional profile to other public accounts and directories."}
    },
    "Reddit":{
      "Chat requests":{kind:"choices",section:"Chat and messaging",options:["Everyone","Accounts older than 30 days","Nobody"],recommended:"Nobody / established accounts",why:"Restricting chat requests reduces unsolicited contact from unknown accounts."},
      "Followers":{kind:"toggle",section:"Followers",label:"Allow people to follow you",value:"Off",recommended:"Off if you do not need followers",why:"Followers can make it easier to monitor new public activity from your account."},
      "Personalization":{kind:"toggles",section:"Personalization",items:[["Personalized recommendations","Off"],["Activity-based recommendations","Off"]],recommended:"Off where not needed",why:"Turning off optional personalization reduces use of activity for recommendations and account discovery."},
      "Public activity":{kind:"status",section:"Profile activity",status:"Posts and comments remain public unless removed",recommended:"Review old posts/comments",why:"A long comment history can reveal interests, locations, routines and identity clues even under a pseudonym."}
    },
    "Snapchat":{
      "Contact Me":{kind:"choices",section:"Contact Me",options:["Friends","Friends and Contacts"],recommended:"Friends",why:"Limiting contact reduces unsolicited messages and calls."},
      "Story audience":{kind:"choices",section:"View My Story",options:["My Friends","Custom"],recommended:"My Friends / Custom",why:"Story audience determines who can see time-sensitive photos, places and activities."},
      "Quick Add":{kind:"toggle",section:"See Me in Quick Add",label:"Show me in Quick Add",value:"Off",recommended:"Off",why:"Turning this off reduces broad friend suggestions based on mutual connections and other signals."},
      "Snap Map":{kind:"toggle",section:"Snap Map",label:"Ghost Mode",value:"On",recommended:"On unless actively sharing",why:"Ghost Mode stops your live Snap Map location from being visible to friends you have not explicitly chosen."},
      "Precise Location":{kind:"location",section:"Snapchat location permission",recommended:"Approximate / While Using",why:"Disabling precise location reduces location accuracy available to Snapchat. Snap Map sharing is controlled separately inside Snapchat."}
    },
    "Discord":{
      "Server DMs":{kind:"toggle",section:"Content & Social",label:"Allow direct messages from server members",value:"Off",recommended:"Off for unfamiliar servers",why:"Turning this off reduces unsolicited DMs from people who merely share a server with you."},
      "Message requests":{kind:"choices",section:"Message requests",options:["Everyone","Friends of friends","Server members","Friends only"],recommended:"Friends / trusted groups",why:"Restricting requests reduces contact from unknown users."},
      "Friend requests":{kind:"toggles",section:"Friend requests",items:[["Everyone","Off"],["Friends of Friends","On"],["Server Members","Off"]],recommended:"Only sources you trust",why:"This reduces broad friend discovery from shared servers."},
      "Activity privacy":{kind:"toggle",section:"Activity Privacy",label:"Share your detected activities with others",value:"Off",recommended:"Off if not needed",why:"Activity sharing can reveal games, apps and usage patterns to other users."}
    },
    "YouTube":{
      "Subscriptions":{kind:"toggle",section:"Privacy",label:"Keep all my subscriptions private",value:"On",recommended:"On",why:"Private subscriptions stop your channel from publicly listing what you follow."},
      "Playlists":{kind:"choices",section:"Playlist visibility",options:["Public","Unlisted","Private"],recommended:"Private / Unlisted",why:"Playlists can reveal interests, routines, travel plans or other personal patterns."},
      "History":{kind:"toggles",section:"Manage all history",items:[["Save watch history","Off / Auto-delete"],["Save search history","Off / Auto-delete"]],recommended:"Use auto-delete or pause if desired",why:"History settings affect what Google stores and uses for recommendations. They do not change comments you already posted publicly."},
      "Comments":{kind:"status",section:"Your public comments",status:"Review and delete comments you no longer want public",recommended:"Audit old comments",why:"Years of comments can reveal identity, interests and activity patterns."}
    },
    "X / Twitter":{
      "Audience / tagging":{kind:"toggles",section:"Audience, media and tagging",items:[["Protect your posts","On"],["Photo tagging","Off / people you follow"]],recommended:"Protect posts if you do not need a public account",why:"These controls limit who can see posts and who can publicly attach your identity to photos."},
      "Protect posts":{kind:"toggle",section:"Audience and tagging",label:"Protect your posts",value:"On",recommended:"On for a private account",why:"Protected posts are visible only to approved followers and are less broadly searchable."},
      "Discoverability":{kind:"toggles",section:"Discoverability and contacts",items:[["Let people find you by email","Off"],["Let people find you by phone","Off"],["Sync address book contacts","Off"]],recommended:"Off unless needed",why:"These switches can connect your account to people who have your contact information."},
      "Discovery":{kind:"toggles",section:"Discoverability and contacts",items:[["Find by email","Off"],["Find by phone","Off"]],recommended:"Off",why:"Turning these off reduces contact-based matching to your account."},
      "Location":{kind:"toggle",section:"Location information",label:"Add location information to posts",value:"Off",recommended:"Off",why:"Turning this off prevents new posts from intentionally including location metadata through X. It does not remove place names or clues you type into posts."}
    },
    "WhatsApp":{
      "Last seen":{kind:"choices",section:"Last seen and online",options:["Everyone","My contacts","My contacts except…","Nobody"],recommended:"My contacts / Nobody",why:"This controls who can see when you last used WhatsApp. Online visibility has a separate linked choice."},
      "Profile photo":{kind:"choices",section:"Profile photo",options:["Everyone","My contacts","My contacts except…","Nobody"],recommended:"My contacts",why:"Limiting your photo reduces what unknown numbers can use to confirm your identity."},
      "About / Status":{kind:"choices",section:"Status privacy",options:["My contacts","My contacts except…","Only share with…"],recommended:"Choose the smallest intended audience",why:"Status updates can expose activities, places and relationships to saved contacts."},
      "Groups":{kind:"choices",section:"Groups",options:["Everyone","My contacts","My contacts except…"],recommended:"My contacts / My contacts except…",why:"This limits who can add you to groups. Group membership can expose your phone number to other members."},
      "Live location":{kind:"status",section:"Live location",status:"Review every chat currently receiving live location",recommended:"Stop sharing when you no longer need it",why:"Live Location shares your real-time location only with the individual or group chats you selected, for the chosen duration. Turning off phone location permission prevents WhatsApp from accessing device location, but it does not erase a static location you already sent."},
      "Location":{kind:"location",section:"WhatsApp location permission",recommended:"While Using / Never when not needed",why:"Allowing location lets WhatsApp access device location for location-sharing features. It does not automatically show your location to everyone. Live Location must still be shared to a chat."}
    },
    "Telegram":{
      "Phone Number":{kind:"choices",section:"Phone Number",options:["Everybody","My Contacts","Nobody"],recommended:"Nobody / My Contacts",why:"Phone-number visibility can directly connect a Telegram account to your real-world identity."},
      "Last seen":{kind:"choices",section:"Last Seen & Online",options:["Everybody","My Contacts","Nobody"],recommended:"My Contacts / Nobody",why:"This controls who can see your recent activity status."},
      "Forwarded messages":{kind:"choices",section:"Forwarded Messages",options:["Everybody","My Contacts","Nobody"],recommended:"My Contacts / Nobody",why:"Restricting forwarded-message links makes it harder for forwarded content to point back to your account."},
      "Groups & Channels":{kind:"choices",section:"Groups & Channels",options:["Everybody","My Contacts"],recommended:"My Contacts",why:"This limits who can add you to groups and channels."},
      "People Nearby":{kind:"status",section:"People Nearby",status:"Nearby discovery should remain off unless you intentionally use it",recommended:"Off",why:"Nearby discovery can expose physical proximity to other Telegram users."}
    },
    "Twitch":{
      "Blocked users":{kind:"status",section:"Blocked users",status:"Review blocked accounts",recommended:"Block accounts that should not contact you",why:"Blocking is the strongest direct control for unwanted contact."},
      "Whispers":{kind:"choices",section:"Whispers",options:["Allow from everyone","Block whispers from strangers"],recommended:"Block whispers from strangers",why:"This reduces unsolicited private messages."},
      "Activity":{kind:"toggle",section:"Activity sharing",label:"Share activity",value:"Off",recommended:"Off if not needed",why:"Activity sharing can connect viewing or gaming behaviour to your public Twitch identity."},
      "Connections":{kind:"status",section:"Connections",status:"Review linked accounts and revoke unused services",recommended:"Keep only services you actively use",why:"Connected accounts can create cross-platform identity links."}
    },
    "GitHub":{
      "Public profile":{kind:"status",section:"Public profile",status:"Name, bio, company, location and website may be public",recommended:"Remove fields you do not need public",why:"These fields can directly tie a username to your employer, city and other profiles."},
      "Public email":{kind:"toggle",section:"Public profile",label:"Public email",value:"Hidden",recommended:"Hidden",why:"A public email address is a strong cross-platform identity key."},
      "Email privacy":{kind:"toggles",section:"Emails",items:[["Keep my email addresses private","On"],["Block command-line pushes that expose my email","On"]],recommended:"On",why:"Using GitHub's no-reply address can prevent commits from exposing your private email."},
      "Public repositories":{kind:"status",section:"Repositories",status:"Review public repositories, issues, pull requests and comments",recommended:"Make sensitive projects private",why:"Repository history can expose employers, projects, usernames and long-term activity patterns."},
      "Contributions":{kind:"toggle",section:"Contribution settings",label:"Show private contributions on my profile",value:"Off / limited",recommended:"Limit if activity patterns are sensitive",why:"Contribution graphs can reveal work cadence and periods of activity even without file contents."},
      "Applications":{kind:"status",section:"Applications",status:"Review authorized OAuth apps and GitHub Apps",recommended:"Revoke unused access",why:"Third-party applications can retain account access until you revoke them."}
    },
    "Pinterest":{
      "Search privacy":{kind:"toggle",section:"Profile visibility",label:"Search privacy",value:"On",recommended:"On if you do not want search-engine discovery",why:"This reduces search-engine visibility of your Pinterest profile."},
      "Boards":{kind:"choices",section:"Board visibility",options:["Public","Secret"],recommended:"Secret for sensitive boards",why:"Public boards can reveal interests, purchases, travel plans and home projects."},
      "Personalization":{kind:"toggles",section:"Personalization",items:[["Use sites you visit","Off"],["Use partner information","Off"]],recommended:"Off if you do not want personalized tracking",why:"These options affect how off-Pinterest activity is used for recommendations and advertising."},
      "Connected accounts":{kind:"status",section:"Connected accounts",status:"Review linked services and sign-in connections",recommended:"Remove unused connections",why:"Linked accounts create cross-platform identity paths."},
      "Discoverability":{kind:"toggle",section:"Contacts and discovery",label:"Sync contacts",value:"Off",recommended:"Off",why:"Contact syncing can expose your account to people who already have your contact information."}
    },
    "Strava":{
      "Profile Page":{kind:"choices",section:"Profile Page",options:["Everyone","Followers"],recommended:"Followers",why:"This limits who can see profile details and social connections."},
      "Activities":{kind:"choices",section:"Activities",options:["Everyone","Followers","Only You"],recommended:"Followers / Only You",why:"Activity visibility determines who can see routes, times and workout details."},
      "Map Visibility":{kind:"toggles",section:"Map Visibility",items:[["Hide start/end around a specific address","On"],["Hide start/end everywhere","On where appropriate"]],recommended:"Hide sensitive start/end points",why:"Route start and end points can reveal home, school or work locations."},
      "Group Activities":{kind:"choices",section:"Group Activities",options:["Everyone","Followers","No One"],recommended:"Followers / No One",why:"Group activities can reveal who you train or travel with."},
      "Flyby":{kind:"choices",section:"Flyby",options:["Everyone","No One"],recommended:"No One",why:"Flyby can reveal proximity to other athletes at a specific time and place."}
    }
  };

  function settingDetailFor(name,target) {
    const specific=APP_SETTING_DETAILS[name]?.[target];
    if(specific) return specific;

    if(target==="Notifications"){
      return {
        kind:"notification",
        section:name+" notifications",
        recommended:"Keep only useful alerts; hide sensitive previews on the lock screen",
        why:"Notification previews can expose names, message content, codes or activity on a locked phone. Turning notifications off does not change who can see your account or posts."
      };
    }

    if(target==="Location"){
      return {
        kind:"location",
        section:name+" location permission",
        recommended:"While Using or Never unless the feature genuinely needs background location",
        why:"Device permission controls whether the app can access location. It does not automatically publish your location to everyone; sharing features inside the app are controlled separately."
      };
    }

    return null;
  }

  function settingTeachingExpansion(detail) {
    if (!detail) return "";
    if (detail.kind==="location") return "Device location permission and in-app location sharing are separate controls, so review both.";
    if (detail.kind==="notification") return "Lock-screen previews can expose content even while the phone is locked, so review previews as well as the main notification switch.";
    if (detail.kind==="choices") return "Choosing a narrower audience reduces how many people can see or use this information to connect your account to other parts of your life.";
    if (detail.kind==="toggle" || detail.kind==="toggles") return "This control affects future exposure, so confirm the switch matches how public you actually want this feature to be.";
    if (detail.kind==="status") return "This is also an audit point: review what is already public or connected, not only the setting going forward.";
    return "";
  }

  function appDefaultSettingFor(name,target,detail) {
    const known = {
      "Instagram":{
        "Private account":"Public for most adult accounts; teen accounts may start private",
        "Contact syncing":"Off until you choose to sync contacts"
      },
      "Facebook":{
        "Future posts":"Friends for many new personal accounts",
        "Location":"No device-location access until you grant permission"
      },
      "TikTok":{
        "Private account":"Public for most adults; younger teen accounts start private",
        "Location":"No device-location access until you grant permission"
      },
      "Snapchat":{
        "Snap Map":"Location sharing is off until you opt in",
        "Precise Location":"No device-location access until you grant permission"
      },
      "YouTube":{
        "Subscriptions":"Private by default"
      },
      "WhatsApp":{
        "Live location":"Off until you intentionally share Live Location in a chat",
        "Location":"No device-location access until you grant permission"
      },
      "GitHub":{
        "Public email":"No public email is shown unless you choose one"
      }
    };

    const exact=known[name]?.[target];
    if(exact) return exact;
    if(detail?.kind==="location") return "No device-location access until you grant permission";
    if(detail?.kind==="notification") return "Depends on phone permission and app setup";
    return "Varies by account, age, region or app version";
  }

  function detailRowsHtml(detail) {
    if (!detail) return "";
    const recommended=String(detail.recommended||"").toLowerCase();
    const optionRow=(label,selected=false,meta="") =>
      '<div class="phoneSettingOption' + (selected ? ' selected' : '') + '">' +
        '<span class="phoneRadio">' + (selected ? '✓' : '') + '</span>' +
        '<span class="phoneOptionCopy"><strong>' + escapeHtml(label) + '</strong>' +
          (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') +
        '</span>' +
      '</div>';

    if (detail.kind === "choices") {
      const chosen=(detail.options||[]).find(option=>recommended.includes(String(option).toLowerCase())) || detail.options?.[0];
      return '<div class="phoneSettingGroup">' + (detail.options||[]).map(option=>optionRow(option,option===chosen)).join("") + '</div>';
    }
    if (detail.kind === "toggle") {
      const on=/on|enabled|hidden|limited/i.test(String(detail.value||""));
      return '<div class="phoneSettingGroup"><div class="phoneSettingToggleRow"><span><strong>' + escapeHtml(detail.label||detail.section) + '</strong><small>' + escapeHtml(detail.value||"") + '</small></span><span class="toggle ' + (on ? 'on' : '') + '"></span></div></div>';
    }
    if (detail.kind === "toggles") {
      return '<div class="phoneSettingGroup">' + (detail.items||[]).map(([label,value])=>{
        const on=/on|enabled/i.test(String(value||""));
        return '<div class="phoneSettingToggleRow"><span><strong>' + escapeHtml(label) + '</strong><small>' + escapeHtml(value||"") + '</small></span><span class="toggle ' + (on ? 'on' : '') + '"></span></div>';
      }).join("") + '</div>';
    }
    if (detail.kind === "location") {
      return '<div class="phoneSettingGroup phoneLocationPermission">' +
        optionRow("Never",/never/i.test(detail.recommended||"")) +
        optionRow("Ask Next Time / Every Time",false) +
        optionRow("While Using the App",!/never/i.test(detail.recommended||"")) +
        optionRow("Always",false) +
        '<div class="phoneSettingToggleRow"><span><strong>Precise Location</strong><small>Use only when the feature genuinely needs exact location</small></span><span class="toggle"></span></div>' +
      '</div>';
    }
    if (detail.kind === "notification") {
      return '<div class="phoneSettingGroup phoneNotificationSettings">' +
        '<div class="phoneSettingToggleRow"><span><strong>Allow notifications</strong><small>Master switch for this app</small></span><span class="toggle on"></span></div>' +
        '<div class="phoneSettingToggleRow"><span><strong>Lock screen</strong><small>Show alerts on the locked device</small></span><span class="toggle"></span></div>' +
        '<div class="phoneSettingToggleRow"><span><strong>Show previews</strong><small>Hide sensitive message/content previews</small></span><span class="toggle"></span></div>' +
        '<div class="phoneSettingToggleRow"><span><strong>Notification categories</strong><small>Choose which kinds of alerts can appear</small></span><span class="phoneChevron">›</span></div>' +
      '</div>';
    }
    if (detail.kind === "status") {
      return '<div class="phoneStatusCard"><span class="phoneStatusDot"></span><strong>' + escapeHtml(detail.status||"Review this setting") + '</strong><small>' + escapeHtml(detail.recommended||"") + '</small></div>';
    }
    return "";
  }

  function isGuideNavigationTarget(target) {
    return String(target || "").startsWith("NAV:");
  }

  function guideNavigationTarget(target) {
    return isGuideNavigationTarget(target) ? String(target).slice(4) : String(target || "");
  }

  function targetUsesToggle(target) {
    return /private account|protect.*post|quick add|precise location|subscriptions private|search engine|downloads|contact sync|sync contacts|ghost mode|activity sharing|location services|tracking|public visibility|allow.*search engine/i.test(String(target || ""));
  }

  function phoneSceneHtml(title, target, explanation) {
    const phoneIcon = guidePlatform?.icon || "⚙";
    const appName = guidePlatform?.name || "Privacy";
    const identity = '<div class="phoneAppIdentity" style="--app-brand:' + escapeHtml(guidePlatform?.brand || "#52d6ff") + '">' +
      '<span class="phoneAppLogo">' + phoneIcon + '</span><span><strong>' + escapeHtml(appName) + '</strong><small>' + (guidePlatform?.device ? 'DEVICE SETTINGS' : 'PRIVACY SETTINGS') + '</small></span>' +
    '</div>';

    if (explanation) {
      return '<div class="phoneScreen phoneTeachingScreen">' +
        identity +
        '<div class="settingSuccess">' +
          '<div class="settingSuccessIcon">✓</div>' +
          '<div class="settingSuccessKicker">SETTING REVIEWED</div>' +
          '<strong>' + escapeHtml(title) + '</strong>' +
          '<span>Pause here and explain what this control changes.</span>' +
        '</div>' +
      '</div>';
    }

    const navigationOnly=isGuideNavigationTarget(target);
    const actualTarget=guideNavigationTarget(target);
    const detail = guidePlatform?.device
      ? deviceSettingDetailFor(guidePlatform.device,actualTarget)
      : settingDetailFor(appName,actualTarget);
    if (detail && !navigationOnly) {
      return '<div class="phoneScreen phoneDetailScreen">' +
        identity +
        '<div class="phoneDetailHeader"><span class="phoneBackChevron">‹</span><span><small>' + escapeHtml(detail.section||title) + '</small><strong>' + escapeHtml(title) + '</strong></span></div>' +
        detailRowsHtml(detail) +
        '<div class="phoneSettingCompare">' +
          '<div class="phoneDefaultSetting"><strong>' + (guidePlatform?.device ? 'DEVICE DEFAULT / NORMAL BEHAVIOUR' : 'APP DEFAULT SETTING') + '</strong><span>' +
            escapeHtml(guidePlatform?.device ? deviceDefaultSettingFor(guidePlatform.device,actualTarget,detail) : appDefaultSettingFor(appName,actualTarget,detail)) +
          '</span></div>' +
          '<div class="phoneRecommendation"><strong>RECOMMENDED PRIVACY SETTING</strong><span>' + escapeHtml(detail.recommended||"Review this setting") + '</span></div>' +
        '</div>' +
      '</div>';
    }

    const menuTarget=navigationOnly ? actualTarget : target;
    const deviceRows = deviceRowsFor(menuTarget);
    const rows = deviceRows || platformRowsFor(appName, menuTarget);
    if (deviceRows && menuTarget && menuTarget !== "EXPLAIN" && !rows.includes(menuTarget)) rows.push(menuTarget);

    const phoneHeader = guidePlatform?.device
      ? phoneHeaderFor(menuTarget)
      : (navigationOnly && detail ? platformHeaderFor(appName,actualTarget) : platformHeaderFor(appName,menuTarget));

    let html = '<div class="phoneScreen">' +
      identity +
      '<div class="phoneTitle"><span class="phoneTitleIcon">' + phoneIcon + '</span><span>' + escapeHtml(phoneHeader) + '</span></div>' +
      '<div class="phoneCurrentScreen">' + escapeHtml(title) + '</div>' +
      '<div class="phoneRows">';

    rows.forEach((r) => {
      const isTarget = menuTarget !== "EXPLAIN" && r === menuTarget;
      const control = isTarget && targetUsesToggle(menuTarget)
        ? '<span class="toggle on"></span>'
        : '<span class="phoneChevron">›</span>';
      html += '<div class="phoneRow' + (isTarget ? " target" : "") + '"><span>' + escapeHtml(r) + '</span>' +
        control +
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
    const navigationOnly=isGuideNavigationTarget(target);
    const actualTarget=guideNavigationTarget(target);
    const detail = guidePlatform?.device
      ? deviceSettingDetailFor(guidePlatform.device,actualTarget)
      : settingDetailFor(guidePlatform?.name,actualTarget);
    const bullets = isExplain
      ? ["What this control changes","What exposure or risk it reduces","What the child/user will notice","Any trade-off or limitation to understand"]
      : ["Follow this exact path on the device","The highlighted row is the next tap","Use the presentation clicker to advance one action at a time"];

    const actionBlock = isExplain
      ? '<div class="explainBox"><strong>What to explain to the audience</strong><ul>' + bullets.map((b)=>"<li>"+escapeHtml(b)+"</li>").join("") + "</ul></div>"
      : detail && !navigationOnly
        ? '<div class="settingWhyCard">' +
            '<div class="settingWhyMain"><strong>WHY THIS SETTING MATTERS</strong><p>' + escapeHtml(detail.why||body) + ' ' + escapeHtml(settingTeachingExpansion(detail)) + '</p></div>' +
            '<div class="settingDefaultTile"><strong>' + (guidePlatform?.device ? 'DEVICE DEFAULT / NORMAL BEHAVIOUR' : 'APP DEFAULT SETTING') + '</strong><p>' +
              escapeHtml(guidePlatform?.device ? deviceDefaultSettingFor(guidePlatform.device,actualTarget,detail) : appDefaultSettingFor(guidePlatform?.name,actualTarget,detail)) +
            '</p></div>' +
            '<div class="settingRecommendedTile"><strong>RECOMMENDED PRIVACY SETTING</strong><p>' + escapeHtml(detail.recommended||"Review this setting") + '</p></div>' +
          '</div>'
        : '<div class="tapCallout"><strong>Next action:</strong>&nbsp; ' + escapeHtml(navigationOnly ? actualTarget : target) + "</div>";

    const html =
      '<div class="coachAppBadge" style="--brand:' + escapeHtml(guidePlatform?.brand || "#52d6ff") + '"><span>' + (guidePlatform?.icon || "⚙") + '</span><strong>' + escapeHtml(guidePlatform?.name || "Privacy") + '</strong></div>' +
      '<div class="eyebrow">' + (isExplain ? "WHY THIS SETTING MATTERS" : "STEP " + (guideIndex + 1)) + '</div>' +
      "<h2>" + escapeHtml(title) + "</h2><p>" + escapeHtml(body) + "</p>" + actionBlock;

    if (!direction) {
      copy.innerHTML = html;
      return;
    }

    copy.classList.remove("copyFadeOut","copyFadeIn");
    void copy.offsetWidth;
    copy.classList.add("copyFadeOut");
    setTimeout(() => {
      copy.innerHTML = html;
      copy.classList.remove("copyFadeOut");
      copy.classList.add("copyFadeIn");
    }, 135);
    setTimeout(() => copy.classList.remove("copyFadeIn"), 430);
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

    newScene.classList.add(direction > 0 ? "phoneSceneNativeIncoming" : "phoneSceneNativeBackIncoming");
    viewport.appendChild(newScene);

    requestAnimationFrame(() => {
      oldScene.classList.add(direction > 0 ? "phoneSceneNativeUnder" : "phoneSceneNativeBackOut");
      newScene.classList.remove(direction > 0 ? "phoneSceneNativeIncoming" : "phoneSceneNativeBackIncoming");
      newScene.classList.add("phoneSceneActive");
    });

    setTimeout(() => {
      if (oldScene.isConnected) oldScene.remove();
      newScene.classList.remove("phoneSceneActive");
    }, 470);
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

      const searchStartedAt = Date.now();
      startCinematicScan([firstName,lastName].filter(Boolean).join(" "));
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
        const elapsed=Date.now()-searchStartedAt;
        setCinematicProgress(Math.min(88,8+(elapsed/MIN_LIVE_SEARCH_MS)*80),statuses[statusIndex][0].replace("…",""));
      }, 900);

      try {
        const res = await fetch("/api/live-search", {
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
          if (res.status === 429) throw new Error("Too many live searches were started in a short period. Wait about one minute, then try again.");
          throw new Error((data.error || "Live search failed.") + (data.detail ? " " + data.detail : ""));
        }

        hydrateCinematicScan(data);
        setCinematicProgress(90,"Correlating results");

        const minimumSearchMs = 3200;
        const waitMs = minimumSearchMs - (Date.now() - searchStartedAt);
        if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
        const remaining = MIN_LIVE_SEARCH_MS - (Date.now() - searchStartedAt);
        if (remaining > 0) await wait(remaining);
        setCinematicProgress(100,"Results ready");
        await wait(320);
        renderReport(data);
      } catch (e) {
        alert(e.message);
      } finally {
        clearInterval(timer);
        scanPanel.classList.add("hidden");
        clearCinematicScan();
        setConsentState();
      }
    });
  }

  const zeroSyntheticBtn = $("zeroSyntheticBtn");
  if (zeroSyntheticBtn) {
    zeroSyntheticBtn.addEventListener("click", () => {
      if (syntheticDemoBtn && consent.checked) syntheticDemoBtn.click();
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
    closeReportDeck();
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

  privacyGuidesBtn?.addEventListener("click", () => openPrivacyGuideHub(false));

  window.addEventListener("hashchange",()=>{
    if(window.location.hash==="#privacy-settings" && !document.body.classList.contains("privacyGuideDirect")){
      openPrivacyGuideHub(true);
    }
  });

  $("reportPrev")?.addEventListener("click", () => showReportStage(reportStageIndex - 1));
  $("reportNext")?.addEventListener("click", () => {
    const stages = reportStages();
    if (reportStageIndex >= stages.length - 1) closeReportDeck();
    else showReportStage(reportStageIndex + 1);
  });
  $("closeReportDeck")?.addEventListener("click", closeReportDeck);
  document.querySelectorAll("[data-report-target]").forEach((button) => {
    button.addEventListener("click", () => showReportStage(Number(button.dataset.reportTarget) || 0));
  });

  window.addEventListener("keydown", (e) => {
    if (results.classList.contains("hidden") || !document.body.classList.contains("reportDeckActive")) return;
    if (!$("coachModal")?.classList.contains("hidden")) return;
    if (["ArrowRight","PageDown"].includes(e.key)) {
      e.preventDefault();
      showReportStage(reportStageIndex + 1);
    } else if (["ArrowLeft","PageUp"].includes(e.key)) {
      e.preventDefault();
      showReportStage(reportStageIndex - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeReportDeck();
    }
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
  if (window.location.hash === "#privacy-settings") openPrivacyGuideHub(true);
})();