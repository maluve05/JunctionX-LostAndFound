/**
 * Every fact the site states, in one place. Nothing here is invented: the
 * numbers, names and dates come from the previous site, the 2026 partnership
 * deck and NOVAe's own timeline. The site shows no prices: partners hear them
 * on a call (CALL_URL). Do not add dates or venue details until they are
 * confirmed.
 */

export const SITE_URL = "https://forgehackathon.com";
export const EMAIL = "main@forgehackathon.com";
export const CALL_URL = "https://calendar.app.google/1TZcovXXmFx6qG5d6";
export const NOVAE_URL = "https://unlnovae.org";
export const RECAP_2025_URL = "https://unlnovae.org/projects/forge-hackathon-2025";

export const SOCIALS = {
  linkedin: "https://www.linkedin.com/company/forgehackathon/",
  instagram: "https://www.instagram.com/forgehackathon/",
};

/** The name FORGe goes by on both, as people would search for it. */
export const SOCIAL_HANDLE = "@forgehackathon";

export const mailto = (subject: string) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`;

/** Connect, build, ship: the weekend in three moves. */
export const PHASES = [
  {
    title: "Connect",
    body: "Builders from technology, data, design, business and entrepreneurship meet the partners setting the challenges.",
  },
  {
    title: "Build",
    body: "Teams form around a real problem and work with real tools, supported by mentors who have shipped before.",
  },
  {
    title: "Ship",
    body: "Every team ends at the same place: a working build and a public demo in front of the room.",
  },
] as const;

/** The 2025 edition, the first FORGe. */
export const RECORD = [
  { value: "120", label: "Builders" },
  { value: "30", label: "Teams" },
  { value: "24h", label: "Straight" },
] as const;

export type Sponsor = { name: string; logo: string };

/** Everyone who backed FORGe 2025. Artwork lives in public/partners/2025/. */
export const SPONSORS_2025: Sponsor[] = [
  { name: "NOVA IMS", logo: "ims.webp" },
  { name: "DareData", logo: "daredata.webp" },
  { name: "Ripply", logo: "ripply.webp" },
  { name: "Sonant", logo: "sonant.webp" },
  { name: "Impact Hall", logo: "impact hall.webp" },
  { name: "ElevenLabs", logo: "elevenlabs.webp" },
  { name: "n8n", logo: "n8n.webp" },
  { name: "BeyondPresence", logo: "beyondpresence.webp" },
  { name: "Data Makers Fest", logo: "datamakers.webp" },
  { name: "Lisbon AI Week", logo: "aiweek.webp" },
  { name: "Red Bull", logo: "redbull.webp" },
  { name: "Espresso Lab", logo: "espressolab.webp" },
];

/** Photographs from FORGe 2025, 7 and 8 November. */
export const PHOTOS_2025 = [
  {
    src: "/novae/builders-at-work.webp",
    alt: "Teams heads-down at their laptops in the FORGe 2025 hacking room, the countdown clock on the wall",
    w: 1200,
    h: 800,
  },
  {
    src: "/photos/2025/room.webp",
    alt: "The FORGe 2025 room from above, every table full",
    w: 1400,
    h: 932,
  },
  {
    src: "/novae/mentors.webp",
    alt: "Two FORGe mentors in 'build something' shirts standing over a team to help them",
    w: 1200,
    h: 800,
  },
  {
    src: "/photos/2025/night.webp",
    alt: "Builders queueing for food late into the night at FORGe 2025",
    w: 1400,
    h: 932,
  },
  {
    src: "/novae/community.webp",
    alt: "The whole FORGe 2025 room with their arms raised at the close of the event",
    w: 1200,
    h: 800,
  },
] as const;

/**
 * More from FORGe 2025. No photograph appears twice in a build, so no visitor
 * sees one twice. PHOTOS_2025 are the home page's 2025 chapter in both builds.
 * These each have one place in each build: on wide screens, "Who we're
 * looking for" (nine) and the partners' outcomes (two); on phones, the
 * weekend on home and on builders (three each) and builders' 2025 (five).
 */
export const MORE_2025 = {
  guestTalk: {
    src: "/photos/2025/guest-talk.webp",
    alt: "A builder in conversation with Professor Leonardo Vanneschi of NOVA IMS at FORGe 2025",
    w: 1400,
    h: 931,
  },
  sofa: {
    src: "/photos/2025/sofa.webp",
    alt: "Three builders on a sofa with game controllers, giving a thumbs up",
    w: 1400,
    h: 932,
  },
  laugh: {
    src: "/photos/2025/laugh.webp",
    alt: "Three builders in 'build something' shirts sharing a laugh",
    w: 1400,
    h: 931,
  },
  fridges: {
    src: "/photos/2025/fridges.webp",
    alt: "Three builders talking by the fridges at FORGe 2025",
    w: 1400,
    h: 931,
  },
  espresso: {
    src: "/photos/2025/espresso.webp",
    alt: "A builder in a cap talking with Professor Leonardo Vanneschi over an espresso",
    w: 1400,
    h: 931,
  },
  guests: {
    src: "/photos/2025/guests.webp",
    alt: "A FORGe organiser talking with guests in suits",
    w: 1400,
    h: 932,
  },
  armInArm: {
    src: "/photos/2025/arm-in-arm.webp",
    alt: "Five builders in FORGe shirts, arm in arm in the hacking room",
    w: 1400,
    h: 931,
  },
  stage: {
    src: "/photos/2025/stage.webp",
    alt: "Professor Leonardo Vanneschi of NOVA IMS speaking on stage at FORGe 2025",
    w: 1400,
    h: 931,
  },
  daredata: {
    src: "/photos/2025/daredata.webp",
    alt: "DareData presenting on the big screen at FORGe 2025",
    w: 1400,
    h: 931,
  },
  hall: {
    src: "/photos/2025/hall.webp",
    alt: "Builders at their tables, facing the front of the FORGe 2025 room",
    w: 1400,
    h: 931,
  },
  backWall: {
    src: "/photos/2025/back-wall.webp",
    alt: "Builders standing along the back of the room, laptops on the tables in front of them",
    w: 1400,
    h: 931,
  },
} as const;

export type Photo2025 = { src: string; alt: string; w: number; h: number };

export type Member = { name: string; role: string; photo: string; linkedin: string };

/**
 * The organising team, in the order the team sheet lists them: project leads
 * and heads first, then leads, then coordinators. Ânia's LinkedIn slug has an
 * accented character, percent-encoded so the URL is valid.
 */
export const CREW: Member[] = [
  {
    name: "David Malínek",
    role: "Project Lead, Head of Technology & Operations",
    photo: "david-malinek",
    linkedin: "https://www.linkedin.com/in/david-malinek/",
  },
  {
    name: "Aashir Mir",
    role: "Project Lead, Head of Growth",
    photo: "aashir-mir",
    linkedin: "https://www.linkedin.com/in/aashirmir/",
  },
  {
    name: "Gustavo Neves",
    role: "Head of Partnerships",
    photo: "gustavo-neves",
    linkedin: "https://www.linkedin.com/in/gustavo-neves-53571b331/",
  },
  {
    name: "Abdul Rehman Khan",
    role: "Executive Advisor",
    photo: "abdul-rehman-khan",
    linkedin: "https://www.linkedin.com/in/abdul-rehman-khan3532/",
  },
  {
    name: "Simão Rodrigues",
    role: "Marketing & Content Lead",
    photo: "simao-rodrigues",
    linkedin: "https://www.linkedin.com/in/simao-rodrigues-5b8baa353/",
  },
  {
    name: "Ânia Mendes",
    role: "Internal Operations Lead",
    photo: "ania-mendes",
    linkedin: "https://www.linkedin.com/in/%C3%A2nia-mendes/",
  },
  {
    name: "Jaime Vera-Cruz",
    role: "Finance & Grants Lead",
    photo: "jaime-vera-cruz",
    linkedin: "https://www.linkedin.com/in/jaimeveracruz/",
  },
  {
    name: "Pedro Gomes",
    role: "Partnerships & Operations Lead",
    photo: "pedro-gomes",
    linkedin: "https://www.linkedin.com/in/pedro-gomes-32a1a3303/",
  },
  {
    name: "Catarina de Carvalho Aparício",
    role: "Legal Lead",
    photo: "catarina-aparicio",
    linkedin: "https://www.linkedin.com/in/catarina-aparicio/",
  },
  {
    name: "Duarte Ayres",
    role: "Lead Developer",
    photo: "duarte-ayres",
    linkedin: "https://www.linkedin.com/in/duarte-ayres-ab3a3429a/",
  },
  {
    name: "Akshay Anand",
    role: "Technology Lead",
    photo: "akshay-anand",
    linkedin: "https://www.linkedin.com/in/akshay-anand-428b0b390/",
  },
  {
    name: "Vasco Plácido",
    role: "Partnerships Coordinator",
    photo: "vasco-placido",
    linkedin: "https://www.linkedin.com/in/vascoplacido/",
  },
  {
    name: "Éber Rodrigues",
    role: "Growth & Technology Coordinator",
    photo: "eber-rodrigues",
    linkedin: "https://www.linkedin.com/in/eber-rodrigues/",
  },
  {
    name: "Miguel Soeiro",
    role: "Operations Coordinator",
    photo: "miguel-soeiro",
    linkedin: "https://www.linkedin.com/in/miguelsoeiro17/",
  },
  {
    name: "João Gonçalves",
    role: "Internal Coordinator",
    photo: "joao-goncalves",
    linkedin: "https://www.linkedin.com/in/joaoaraujogoncalves/",
  },
  {
    name: "Malvin (Tafadzwa) Chitswamatombo",
    role: "Technology Coordinator",
    photo: "malvin-chitswamatombo",
    linkedin: "https://www.linkedin.com/in/malvin-chitswamatombo-861b06207/",
  },
];

/** What NOVAe stands for, one plain sentence each. */
export const NOVAE_VALUES = [
  {
    title: "Builder-first",
    line: "You learn by doing: hands-on programmes, events and challenges.",
  },
  {
    title: "Founder-powered",
    line: "Support at every stage, from a first idea to a growing startup.",
  },
  {
    title: "Connected",
    line: "Portuguese talent, linked to Europe's startup ecosystem.",
  },
] as const;

/** NOVAe's path so far, from its own timeline on unlnovae.org. */
export const NOVAE_TIMELINE = [
  { when: "Nov 2023", what: "NOVAe is founded at NOVA IMS" },
  { when: "May 2024", what: "eSummit, 50+ aspiring founders" },
  { when: "Mar 2025", what: "First inNOVAetors Academy" },
  { when: "Nov 2025", what: "The first FORGe" },
  { when: "Mar 2026", what: "MoveMentor launches" },
  { when: "Nov 2026", what: "FORGe 2026", next: true },
] as const;

export const PROFILES = [
  {
    title: "Students",
    desc: "University students from any subject, year or country. You do not need to study computer science to apply.",
  },
  {
    title: "Aspiring founders",
    desc: "You have an idea, a problem you care about or the ambition to start something, and want the people and momentum to make it real.",
  },
  {
    title: "Developers & technical builders",
    desc: "Software developers, AI engineers, data people, hardware builders and anyone who wants to turn ideas into working products.",
  },
  {
    title: "Designers & creatives",
    desc: "Product, UX/UI, brand, visual and creative thinkers who can shape an idea into something people want to use.",
  },
  {
    title: "Business builders",
    desc: "Strategists, marketers, operators, finance minds and storytellers who can validate an opportunity, define a market and deliver a compelling pitch.",
  },
  {
    title: "First-time hackers",
    desc: "Never been to a hackathon? Perfect. Come curious, find a team and learn by building.",
  },
  {
    title: "Experienced hackers",
    desc: "Bring your skills, meet ambitious people and push for the next level through partner challenges and competition.",
  },
  {
    title: "International applicants",
    desc: "FORGe welcomes builders from Portugal and beyond. If you can make it to Lisbon, you can apply.",
  },
  {
    title: "Teams and solo applicants",
    desc: "Apply with an existing team or on your own. Solo applicants will have opportunities to meet potential teammates before and during the event.",
  },
] as const;

/** The six partner outcomes, straight from the 2026 partnership deck. */
export const OUTCOMES = [
  {
    title: "Product adoption",
    body: "Builders use your product in live projects, under real deadlines.",
  },
  {
    title: "Developer reach",
    body: "Meet teams, mentors and technical communities in one room.",
  },
  {
    title: "Brand exposure",
    body: "Visible in the build, the venue and the marketing around it.",
  },
  {
    title: "Hiring access",
    body: "Identify standout builders through the work they actually produce.",
  },
  {
    title: "Ecosystem access",
    body: "Connect with industry, government, university and community leaders.",
  },
  {
    title: "Market insight",
    body: "See what builders create, where they get stuck, and why.",
  },
] as const;

export type Tier = {
  id: string;
  name: string;
  tagline: string;
  perks: string[];
  /** Talent tier only: pick a level, each with its own perks. */
  levels?: { name: string; perks: string[] }[];
};

/*
  A catalog, kept deliberately short: a partner should be able to scan a tier
  and book a call. No prices on the site; they come up on the call, from the
  internal tiers doc.
*/
export const TIERS: Tier[] = [
  {
    id: "marquee",
    name: "Marquee",
    tagline: "Headline FORGe 2026. Up to three places.",
    perks: [
      "“FORGe 2026, presented by you”",
      "The opening keynote",
      "Naming rights and first pick of challenge",
      "Exclusive recruiting and CV access",
    ],
  },
  {
    id: "builder",
    name: "Builder",
    tagline: "Put your product in every builder’s hands.",
    perks: [
      "Logo on the “Built with” wall",
      "Your own “Best use of” prize category",
      "A workshop or office-hours slot",
    ],
  },
  {
    id: "talent",
    name: "Talent",
    tagline: "Meet and hire the builders in the room.",
    perks: [],
    levels: [
      // No booths until the team confirms partners can have their own.
      {
        name: "Gold",
        perks: ["Large logo everywhere", "Option to run a challenge"],
      },
      {
        name: "Silver",
        perks: ["Recruiter badges", "CV access"],
      },
      {
        name: "Bronze",
        perks: ["A table on site", "Logo on the sponsor wall"],
      },
    ],
  },
  {
    id: "venue",
    name: "Venue & Logistics",
    tagline: "Power the weekend with space, food or kit.",
    perks: [
      "Branded signage where it’s used",
      "Logo on the thank-you wall",
      "A shout-out in the opening remarks",
    ],
  },
  {
    id: "community",
    name: "Community",
    tagline: "Bring your community. Grow together.",
    perks: ["Co-branded partner badge", "Cross-promotion to both audiences", "Passes to the event"],
  },
];

export type Faq = { q: string; a: string };

/*
  Short on purpose: builders should scan, click and register. Every answer
  restates something already published on the site.
*/
export const BUILDER_FAQS: Faq[] = [
  { q: "When and where?", a: "Lisbon, November 2026, during Web Summit week." },
  {
    q: "Do I need a team?",
    a: "No. Apply solo or with a team. Solo builders meet teammates before and during the event.",
  },
  {
    q: "Never been to a hackathon?",
    a: "Perfect. Come curious, find a team and learn by building.",
  },
  { q: "Do I need to study computer science?", a: "No. Any subject, any year, any country." },
  {
    q: "Can I come from outside Portugal?",
    a: "Yes. If you can make it to Lisbon, you can apply.",
  },
];

/* Short on purpose. Every answer restates something already on the page. */
export const PARTNER_FAQS: Faq[] = [
  {
    q: "How much does it cost?",
    a: "It depends on the tier and what you want from the weekend, so we talk it through on a 15-minute call. Venue, logistics and community partners can contribute in kind.",
  },
  {
    q: "Can we set our own challenge?",
    a: "Yes. Tracks are built around real partner problems, and early partners help shape them.",
  },
  {
    q: "Who will we meet?",
    a: "Developers, designers, founders and students from Portugal and abroad. Every one of them applied to be there.",
  },
  { q: "When and where?", a: "Lisbon, November 2026, during Web Summit week." },
  {
    q: "Who has partnered before?",
    a: "NOVA IMS, ElevenLabs, n8n, Red Bull and more backed 2025. NOVA IMS is confirmed for 2026.",
  },
];
