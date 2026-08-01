export type Course = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  lessons: number;
  chapters: number;
  students: string;
  description: string;
  videoUrl: string;
  image: string;
};

export type FeaturedCourse = {
  name: string;
  subtitle: string;
  priceLabel: string;
  badge: string;
  image: string;
};

export type ShopProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  image: string;
  description: string;
  specs: { label: string; value: string }[];
};

export function formatRs(n: number) {
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

export const featuredCourses: FeaturedCourse[] = [
  {
    name: "Flutter Masterclass",
    subtitle: "48 lessons · 12 hours · certificate",
    priceLabel: "Rs 6,900",
    badge: "Featured",
    image: "/courses/featured_01.jpg",
  },
  {
    name: "UX Design Bootcamp",
    subtitle: "Portfolio-ready in 8 weeks",
    priceLabel: "Rs 8,900",
    badge: "Bestseller",
    image: "/courses/featured_02.jpg",
  },
  {
    name: "AI for Innovators",
    subtitle: "Ship AI features without a PhD",
    priceLabel: "Rs 7,400",
    badge: "New",
    image: "/courses/featured_03.jpg",
  },
];

const vBee =
  "https://flutter.github.io/assets-for-api-docs/assets/videos/bee.mp4";
const vButterfly =
  "https://flutter.github.io/assets-for-api-docs/assets/videos/butterfly.mp4";
const vBlazes =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const vEscapes =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
const vJoyrides =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
const vMeltdowns =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4";
const vSubaru =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4";
const vElephants =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";

export const courses: Course[] = [
  {
    id: "c1",
    name: "Liquid UI Design",
    category: "Design",
    price: 4900,
    rating: 4.9,
    lessons: 24,
    chapters: 8,
    students: "3.2k",
    description:
      "Master soft glass surfaces, spring motion, and liquid layouts. Build portfolio-ready interfaces with depth and blur.",
    videoUrl: vBee,
    image: "/courses/course_01.jpg",
  },
  {
    id: "c2",
    name: "Flutter From Zero",
    category: "Development",
    price: 5900,
    rating: 4.8,
    lessons: 42,
    chapters: 12,
    students: "5.6k",
    description:
      "Go from blank project to a polished app: widgets, state, navigation, networking, and shipping patterns.",
    videoUrl: vButterfly,
    image: "/courses/course_02.jpg",
  },
  {
    id: "c3",
    name: "Design Systems Pro",
    category: "Design",
    price: 3900,
    rating: 4.9,
    lessons: 18,
    chapters: 6,
    students: "2.4k",
    description:
      "Create tokens, components, and documentation that scale without slowing delivery.",
    videoUrl: vBlazes,
    image: "/courses/course_03.jpg",
  },
  {
    id: "c4",
    name: "API Mastery",
    category: "Development",
    price: 4400,
    rating: 4.8,
    lessons: 30,
    chapters: 9,
    students: "1.9k",
    description:
      "Design, consume, and secure REST APIs: auth, pagination, caching, and production error handling.",
    videoUrl: vEscapes,
    image: "/courses/course_04.jpg",
  },
  {
    id: "c5",
    name: "Startup Finance",
    category: "Business",
    price: 2900,
    rating: 4.6,
    lessons: 16,
    chapters: 5,
    students: "1.4k",
    description:
      "Runway, pricing, unit economics, and fundraising basics with practical founder frameworks.",
    videoUrl: vJoyrides,
    image: "/courses/course_05.jpg",
  },
  {
    id: "c6",
    name: "Pitch Like a Pro",
    category: "Business",
    price: 1900,
    rating: 4.5,
    lessons: 12,
    chapters: 4,
    students: "980",
    description:
      "Structure a story investors remember: slide craft, delivery drills, and objection handling.",
    videoUrl: vMeltdowns,
    image: "/courses/course_06.jpg",
  },
  {
    id: "c7",
    name: "Brand Storytelling",
    category: "Marketing",
    price: 2400,
    rating: 4.7,
    lessons: 14,
    chapters: 5,
    students: "1.7k",
    description:
      "Find your brand voice and turn it into campaigns that build loyal audiences.",
    videoUrl: vSubaru,
    image: "/courses/course_07.jpg",
  },
  {
    id: "c8",
    name: "SEO Fundamentals",
    category: "Marketing",
    price: 1500,
    rating: 4.6,
    lessons: 10,
    chapters: 4,
    students: "1.1k",
    description:
      "Keyword research, on-page structure, and technical basics that help pages rank and convert.",
    videoUrl: vElephants,
    image: "/courses/course_08.jpg",
  },
];

export const courseCategories = [
  "All",
  "Design",
  "Development",
  "Business",
  "Marketing",
] as const;

export const shopProducts: ShopProduct[] = [
  {
    id: "p1",
    name: "Pitch Deck Kit",
    category: "Templates",
    price: 2400,
    rating: 4.9,
    image: "/shop/product_01.jpg",
    description:
      "Investor-ready pitch deck with 24 editable slides, sample narratives, and speaker notes.",
    specs: [
      { label: "Format", value: "PPTX + Keynote + PDF" },
      { label: "Slides", value: "24 editable layouts" },
      { label: "License", value: "Commercial · 1 team" },
    ],
  },
  {
    id: "p2",
    name: "UX Research Course",
    category: "Courses",
    price: 4900,
    rating: 4.8,
    image: "/shop/product_02.jpg",
    description:
      "Plan interviews, run usability tests, and present findings that change the roadmap.",
    specs: [
      { label: "Lessons", value: "32 video lessons" },
      { label: "Duration", value: "6.5 hours" },
      { label: "Certificate", value: "Yes · Innovator" },
    ],
  },
  {
    id: "p3",
    name: "Startup Playbook",
    category: "E-books",
    price: 1900,
    rating: 4.7,
    image: "/shop/product_03.jpg",
    description:
      "Idea validation, MVP scoping, hiring, pricing, and first fundraising conversations.",
    specs: [
      { label: "Pages", value: "148 pages" },
      { label: "Format", value: "PDF + EPUB" },
      { label: "Extras", value: "Notion checklist pack" },
    ],
  },
  {
    id: "p4",
    name: "Brand Identity Pack",
    category: "Design",
    price: 3200,
    rating: 4.9,
    image: "/shop/product_04.jpg",
    description:
      "Logo lockups, color systems, type pairings, social templates, and a brand guide.",
    specs: [
      { label: "Files", value: "AI · Figma · PNG · SVG" },
      { label: "Templates", value: "12 social posts" },
      { label: "License", value: "Commercial · unlimited" },
    ],
  },
  {
    id: "p5",
    name: "Roadmap Planner",
    category: "Tools",
    price: 1500,
    rating: 4.6,
    image: "/shop/product_05.jpg",
    description:
      "Now / next / later boards and stakeholder-ready export views for small product teams.",
    specs: [
      { label: "Platform", value: "Notion + Sheets" },
      { label: "Views", value: "Timeline · Board · List" },
      { label: "Seats", value: "Up to 8 collaborators" },
    ],
  },
  {
    id: "p6",
    name: "Product Spec Doc",
    category: "Templates",
    price: 1200,
    rating: 4.8,
    image: "/shop/product_06.jpg",
    description:
      "PRD template for goals, user stories, edge cases, and success metrics on one canvas.",
    specs: [
      { label: "Format", value: "Doc · Notion · Markdown" },
      { label: "Sections", value: "11 structured blocks" },
      { label: "Examples", value: "3 filled samples" },
    ],
  },
  {
    id: "p7",
    name: "Growth Marketing 101",
    category: "Courses",
    price: 3900,
    rating: 4.7,
    image: "/shop/product_07.jpg",
    description:
      "Acquisition loops, retention experiments, and weekly growth rituals for small teams.",
    specs: [
      { label: "Lessons", value: "28 video lessons" },
      { label: "Duration", value: "5 hours" },
      { label: "Certificate", value: "Yes · Innovator" },
    ],
  },
  {
    id: "p8",
    name: "Investor One-Pager",
    category: "Templates",
    price: 900,
    rating: 4.5,
    image: "/shop/product_08.jpg",
    description:
      "A single-page teaser for problem, solution, traction, and the ask, built for a 30-second skim.",
    specs: [
      { label: "Format", value: "PDF · Figma · Docs" },
      { label: "Pages", value: "1 page · 2 variants" },
      { label: "Delivery", value: "Instant download" },
    ],
  },
];

export const shopCategories = [
  "All",
  "Templates",
  "Courses",
  "E-books",
  "Design",
  "Tools",
] as const;
