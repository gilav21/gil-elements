// Runs the Dockerized sonar-scanner against a local SonarQube.
// Token: SONAR_TOKEN in the environment, or in a gitignored .env / packages/.env file.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

function resolveToken() {
    if (process.env.SONAR_TOKEN) return process.env.SONAR_TOKEN;
    for (const file of ['.env', 'packages/.env']) {
        if (!existsSync(file)) continue;
        const match = /^SONAR_TOKEN=(.+)$/m.exec(readFileSync(file, 'utf8'));
        if (match) return match[1].trim();
    }
    return '';
}

const token = resolveToken();
if (!token) {
    console.error('SONAR_TOKEN is not set (environment, .env or packages/.env).');
    process.exit(1);
}

// A failing test is reported but does not stop the analysis: the scan reads code, tests only feed its coverage number.
if (!process.argv.includes('--skip-tests')) {
    const tests = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', '--run', '--coverage', '--coverage.reportOnFailure'], { stdio: 'inherit' });
    if (tests.error || tests.status !== 0) console.warn(`Tests ${tests.error ? 'could not run' : 'failed'}: scanning anyway, coverage may be partial or stale. Fix this before merging.`);
}

// vitest writes `SF:packages\base\...` on Windows; the Linux scanner container needs forward slashes.
const lcov = 'coverage/lcov.info';
if (existsSync(lcov)) {
    writeFileSync(lcov, readFileSync(lcov, 'utf8').replace(/^SF:.*$/gm, (line) => line.replaceAll('\\', '/')));
} else {
    console.warn(`${lcov} not found: the scan will report no coverage (run \`pnpm run test:coverage\` first).`);
}

const host = process.env.SONAR_HOST_URL ?? 'http://host.docker.internal:9000';
const result = spawnSync(
    'docker',
    ['run', '--rm', '--add-host=host.docker.internal:host-gateway', '-e', `SONAR_HOST_URL=${host}`, '-e', `SONAR_TOKEN=${token}`, '-v', `${process.cwd()}:/usr/src`, 'sonarsource/sonar-scanner-cli'],
    { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
