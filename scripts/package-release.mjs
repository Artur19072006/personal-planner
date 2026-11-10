import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const output = join(root, 'deploy', 'artifacts');
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
async function files(directory) {
  const rows = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) rows.push(...await files(path));
    else if (item.isFile()) rows.push({ path: relative(dist, path).replaceAll('\\', '/'), sha256: sha256(await readFile(path)) });
    else throw new Error('Release must contain only regular files and directories');
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}
const entries = await files(dist);
const webManifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'));
for (const name of ['index.html', 'sw.js', 'manifest.webmanifest', ...webManifest.icons.map(icon => icon.src.replace(/^\//, ''))]) {
  if (!entries.some(entry => entry.path === name)) throw new Error(`Missing production asset: ${name}`);
}
const createdAt = new Date().toISOString();
const releaseId = `${createdAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${sha256(Buffer.from(JSON.stringify(entries))).slice(0, 12)}`;
const archiveName = `personal-planner-${releaseId}.tar.gz`;
await mkdir(output, { recursive: true });
const archivePath = join(output, archiveName);
const result = spawnSync('tar', ['-czf', archivePath, '-C', dist, '.'], { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`tar failed: ${result.status}`);
const archiveSha256 = sha256(await readFile(archivePath));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = { app: 'personal-planner', version, releaseId, createdAt, archiveName, archiveSha256, files: entries };
await writeFile(join(output, `${releaseId}.json`), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(output, `${archiveName}.sha256`), `${archiveSha256}  ${archiveName}\n`);
console.log(JSON.stringify({ releaseId, archivePath, archiveSha256, fileCount: entries.length }));
