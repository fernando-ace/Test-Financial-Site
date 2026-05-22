import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const root = process.cwd();
const distAssetsDir = join(root, "dist", "assets");
const rootAssetsDir = join(root, "assets");
const rootIndexPath = join(root, "index.html");
const distIndexPath = join(root, "dist", "index.html");

if (!existsSync(distAssetsDir)) {
  throw new Error("Missing dist/assets. Run npm run build before syncing Pages assets.");
}

mkdirSync(rootAssetsDir, { recursive: true });

for (const file of readdirSync(rootAssetsDir)) {
  if (/^index-.*\.(css|js)$/.test(file)) {
    rmSync(join(rootAssetsDir, file));
  }
}

for (const file of readdirSync(distAssetsDir)) {
  if (/^index-.*\.(css|js)$/.test(file)) {
    copyFileSync(join(distAssetsDir, file), join(rootAssetsDir, file));
  }
}

const distHtml = readFileSync(distIndexPath, "utf8");
const cssMatch = distHtml.match(/href="([^"]*\/assets\/index-[^"]+\.css)"/);
const jsMatch = distHtml.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/);

if (!cssMatch || !jsMatch) {
  throw new Error("Could not find built CSS and JS asset references in dist/index.html.");
}

const cssAsset = `/Test-Financial-Site/assets/${basename(cssMatch[1])}`;
const jsAsset = `/Test-Financial-Site/assets/${basename(jsMatch[1])}`;

const rootHtml = readFileSync(rootIndexPath, "utf8")
  .replace(/stylesheet\.href = ".*?";/, `stylesheet.href = "${cssAsset}";`)
  .replace(/bundle\.src = ".*?";/, `bundle.src = "${jsAsset}";`);

writeFileSync(rootIndexPath, rootHtml);

console.log(`Synced GitHub Pages main-branch assets: ${basename(cssAsset)}, ${basename(jsAsset)}`);
