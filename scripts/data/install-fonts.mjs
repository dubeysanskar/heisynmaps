// Installs the map's label fonts (Noto Sans, SIL Open Font Licence) into public/fonts so
// the style never loads glyphs from a third-party server.
//
//   npm run data:fonts                         # downloads the OpenMapTiles font pack
//   npm run data:fonts -- --zip=./v2.0.zip     # or use a zip you already have
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FONTS = ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"];
const URL = "https://github.com/openmaptiles/fonts/releases/download/v2.0/v2.0.zip";
const zipArg = process.argv.find((a) => a.startsWith("--zip="))?.slice(6);

let zip = zipArg ? path.resolve(zipArg) : path.join(os.tmpdir(), "heisyn-fonts.zip");
if (!zipArg) {
  console.log(`Downloading ${URL} …`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "heisyn-fonts-"));
// Windows' own tar.exe and macOS tar (bsdtar) read zip files; GNU tar (Linux, Git Bash) does not.
const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
try {
  execFileSync(tar, ["-xf", zip, "-C", work], { stdio: "inherit" });
} catch {
  execFileSync("unzip", ["-q", zip, "-d", work], { stdio: "inherit" });
}

// The pack may nest fonts one level down; find each font directory by name.
function findDir(root, name) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    if (entry.name === name) return full;
    const nested = findDir(full, name);
    if (nested) return nested;
  }
  return null;
}

const dest = path.resolve("public/fonts");
let bytes = 0;
for (const font of FONTS) {
  const src = findDir(work, font);
  if (!src) throw new Error(`Font "${font}" not found in the pack`);
  const to = path.join(dest, font);
  fs.mkdirSync(to, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, file), path.join(to, file));
    bytes += fs.statSync(path.join(to, file)).size;
  }
}
fs.rmSync(work, { recursive: true, force: true });
console.log(`Installed ${FONTS.join(", ")} → public/fonts (${(bytes / 1e6).toFixed(1)} MB). The map style now serves its own fonts.`);
