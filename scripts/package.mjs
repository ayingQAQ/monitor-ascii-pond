import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createArchive, inspectArchive } from "./archive.mjs";
const root = resolve(import.meta.dirname, "..");
import "./notices.mjs";
const manifest = JSON.parse(
  await readFile(resolve(root, "theme.json"), "utf8"),
);
if (manifest.short !== "monitor-pond" || manifest.version !== "1.0.4")
  throw Error("Unexpected manifest identity");
const files = [];
async function add(name) {
  const location = join(root, name);
  if ((await stat(location)).isDirectory()) {
    for (const entry of (await readdir(location)).sort())
      await add(name + "/" + entry);
    return;
  }
  files.push({ name, data: await readFile(location) });
}
for (const name of [
  "theme.json",
  "preview.png",
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt",
  "licenses",
  "dist",
])
  await add(name);
for (const f of files.filter((f) => /^dist\/.*\.(js|html|css)$/.test(f.name))) {
  const text = f.data.toString("utf8");
  for (const marker of [
    "demoHistory",
    "demoNodes",
    "东京 · 一叶",
    "池畔观测站",
    "/dev/fixtures",
    "/dev/source",
    "/dev/engine",
  ])
    if (text.includes(marker))
      throw Error(`Demo marker ${marker} in ${f.name}`);
}
const index = files.find((f) => f.name === "dist/index.html").data.toString();
for (const [, asset] of index.matchAll(/(?:src|href)="\/(.*?)"/g))
  if (!files.some((f) => f.name === "dist/" + asset))
    throw Error("Missing asset: " + asset);
const gzip = createArchive(files),
  names = inspectArchive(gzip);
if (
  ![
    "theme.json",
    "preview.png",
    "LICENSE",
    "dist/index.html",
    "dist/fonts/geist-mono.woff2",
  ].every((n) => names.includes(n))
)
  throw Error("Invalid archive root");
const hash = createHash("sha256").update(gzip).digest("hex");
await writeFile(join(root, "theme.tar.gz"), gzip);
await writeFile(join(root, "theme.tar.gz.sha256"), hash + "  theme.tar.gz\n");
console.log(
  JSON.stringify(
    {
      files: names.length,
      bytes: gzip.length,
      sha256: hash,
      root: names.filter((n) => !n.includes("/")),
      gzip: "valid",
    },
    null,
    2,
  ),
);
