import { mkdir, copyFile, readFile } from "node:fs/promises";
import path from "node:path";

// Supply physical entry pages so shared links and refreshes work on static hosting.
const output = path.resolve("dist-clearing");
const html = await readFile(path.join(output, "index.html"), "utf8");
if (!html.includes('src="/lumina/assets/'))
  throw new Error("Build with --base=/lumina/ first.");
for (const route of [
  "piano",
  "chords",
  "scales",
  "progressions",
  "pitch-pipe",
  "studio",
]) {
  await mkdir(path.join(output, route), { recursive: true });
  await copyFile(
    path.join(output, "index.html"),
    path.join(output, route, "index.html"),
  );
}
console.log(
  "Lumina is ready to copy into The Clearing's dist/lumina directory.",
);
