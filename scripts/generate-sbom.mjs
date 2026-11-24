import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

const components = [];

for (const [pkgPath, meta] of Object.entries(lock.packages ?? {})) {
  if (!pkgPath || !pkgPath.startsWith('node_modules/')) continue;
  const name = pkgPath.replace(/^.*node_modules\//, '');
  const version = meta.version ?? 'unknown';
  const license = typeof meta.license === 'string' ? meta.license : 'SEE_PACKAGE';
  components.push({
    type: 'library',
    name,
    version,
    license,
    purl: `pkg:npm/${name.replace('@', '%40')}@${version}`,
  });
}

components.sort((a, b) => a.name.localeCompare(b.name));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
    },
  },
  components,
};

fs.writeFileSync(path.join(releaseDir, 'sbom.json'), JSON.stringify(sbom, null, 2), 'utf8');

const licenseLines = [
  '# THIRD-PARTY LICENSES — Fred, der Klemmbaumeister (Gemini Edition)',
  '',
  `Generiert am ${new Date().toISOString()} aus \`package-lock.json\` (${components.length} Pakete).`,
  '',
  '| Paket | Version | Lizenz |',
  '|-------|---------|--------|',
  ...components.map((c) => `| \`${c.name}\` | ${c.version} | ${c.license} |`),
  '',
];

fs.writeFileSync(path.join(releaseDir, 'THIRD_PARTY_LICENSES.md'), licenseLines.join('\n'), 'utf8');
console.log(`SBOM & Licenses generated (${components.length} packages).`);
