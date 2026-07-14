// Run by .github/workflows/bump-version.yml on every push that touches
// index.html/css/js. Rewrites the ?v= cache-buster on the entry
// script/stylesheet tags to the current commit SHA, so browsers never need
// to be manually told a new version exists.
import { readFile, writeFile } from 'node:fs/promises';

const indexPath = new URL('../index.html', import.meta.url);
const version = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 7);

const html = await readFile(indexPath, 'utf8');
const updated = html
  .replace(/(css\/style\.css\?v=)[^"]+/, `$1${version}`)
  .replace(/(js\/app\.js\?v=)[^"]+/, `$1${version}`);

await writeFile(indexPath, updated);
console.log(`Bumped asset version to ${version}`);
