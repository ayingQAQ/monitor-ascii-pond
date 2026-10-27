import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const lock = JSON.parse(
  await readFile(join(root, "package-lock.json"), "utf8"),
);
const notices = [
  "MONITOR POND — THIRD-PARTY NOTICES\nGenerated from the lockfile. Runtime dependencies; upstream pond, data and font licenses are in licenses/.\n",
];
const seen = new Set();
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const location = join(root, path),
    pkg = JSON.parse(await readFile(join(location, "package.json"), "utf8")),
    key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  let names = (await readdir(location)).filter((n) =>
    /^(licen[sc]e|copying|notice)(\.|$)/i.test(n),
  );
  if (pkg.name === "victory-vendor") {
    names = names.concat(
      (await readdir(join(location, "lib-vendor"))).map(
        (n) => `lib-vendor/${n}/LICENSE`,
      ),
    );
    notices.push(
      await readFile(join(root, "licenses/VICTORY-MIT.txt"), "utf8"),
    );
  }
  if (!names.length) throw new Error(`Missing license text for ${key}`);
  notices.push(
    `\n${"=".repeat(72)}\n${key}\nLicense: ${pkg.license || entry.license || "See below"}\nhttps://www.npmjs.com/package/${pkg.name}\n`,
  );
  for (const name of names)
    notices.push(
      `--- ${name} ---\n${await readFile(join(location, name), "utf8")}\n`,
    );
}
await writeFile(
  join(root, "THIRD_PARTY_NOTICES.txt"),
  notices.join("\n").trimEnd() + "\n",
);
console.log(`Collected license texts for ${seen.size} runtime packages`);
