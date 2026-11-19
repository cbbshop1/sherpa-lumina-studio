import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Supply physical entry pages so shared links and refreshes work on static hosting.
// Each page gets its own title, description and address, so search engines and
// agents that do not run JavaScript can tell the rooms apart.
const SITE = "https://cbbsherpa.com";
const output = path.resolve("dist-clearing");
const html = await readFile(path.join(output, "index.html"), "utf8");
if (!html.includes('src="/lumina/assets/'))
  throw new Error("Build with --base=/lumina/ first.");

const home = {
  title: "Lumina | A little music studio",
  description:
    "Follow your ear. Explore chords, scales, pitch and tone, or make a little music in eight connected browser tools.",
};
const pages = {
  "": home,
  piano: {
    title: "Piano · Lumina",
    description:
      "Find a melody, play a chord, or let your fingers wander on a piano in your browser.",
  },
  chords: {
    title: "Chord library · Lumina",
    description: "Choose a chord. See its notes. Hear how they fit together.",
  },
  scales: {
    title: "Scale explorer · Lumina",
    description:
      "Explore the small steps that give a scale its character, and hear each one.",
  },
  progressions: {
    title: "Progressions · Lumina",
    description:
      "Pick a key, see the chords that live in it, and find where they lead.",
  },
  rhythm: {
    title: "The rhythm room · Lumina",
    description:
      "Build a groove in any meter, from rock to samba to 7/8, and sing over it.",
  },
  chart: {
    title: "The chart room · Lumina",
    description:
      "Bring in a score. See its four parts, hear them, and watch what the chords are doing.",
  },
  "pitch-pipe": {
    title: "Pitch & tone · Lumina",
    description:
      "Find a reference pitch, or record your voice and see its waveform and spectrum.",
  },
  studio: {
    title: "The studio · Lumina",
    description:
      "A four-track tape deck for voices. Sing a part, then harmonize with yourself.",
  },
};

const attr = (text) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const replaceOnce = (source, pattern, replacement) => {
  if (!pattern.test(source))
    throw new Error(`Missing ${pattern} in index.html`);
  return source.replace(pattern, replacement);
};

const pageFor = (route, { title, description }) => {
  const url = `${SITE}/lumina/${route ? `${route}/` : ""}`;
  let page = html;
  page = replaceOnce(
    page,
    /<title>[^<]*<\/title>/,
    `<title>${attr(title)}</title>`,
  );
  page = replaceOnce(
    page,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${attr(description)}" />`,
  );
  page = replaceOnce(
    page,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${attr(title)}" />`,
  );
  page = replaceOnce(
    page,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${attr(description)}" />`,
  );
  // The Lumina mark is square, so link previews use the square card.
  page = replaceOnce(
    page,
    /content="summary_large_image"/,
    'content="summary"',
  );
  page = page.replace(
    /https:\/\/[a-z0-9.-]+\/lumina\/brand\//g,
    `${SITE}/lumina/brand/`,
  );
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    description,
    url,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any modern web browser",
    browserRequirements:
      "Requires JavaScript. Microphone features are optional.",
    isAccessibleForFree: true,
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE}/#site`,
      name: "The Clearing",
      url: `${SITE}/`,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE}/#collective`,
      name: "The Clearing Collective",
      url: `${SITE}/about.html`,
    },
  };
  page = page.replace(
    "</head>",
    `  <link rel="canonical" href="${url}" />\n` +
      `    <meta property="og:url" content="${url}" />\n` +
      `    <meta property="og:site_name" content="The Clearing" />\n` +
      `    <script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>\n` +
      "  </head>",
  );
  const rooms = Object.entries(pages)
    .filter(([key]) => key)
    .map(
      ([key, value]) =>
        `<a href="/lumina/${key}/">${attr(value.title.replace(" · Lumina", ""))}</a>`,
    )
    .join(" · ");
  page = replaceOnce(
    page,
    /<div id="root"><\/div>/,
    `<div id="root"></div>\n    <noscript><p>${attr(title)}: ${attr(description)} Lumina is a little music studio in The Clearing and needs JavaScript. Its rooms: ${rooms}. <a href="/map.html">See everything in The Clearing</a>.</p></noscript>`,
  );
  return page;
};

for (const [route, meta] of Object.entries(pages)) {
  const directory = path.join(output, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "index.html"), pageFor(route, meta));
}
console.log(
  "Lumina is ready to copy into The Clearing's dist/lumina directory.",
);
