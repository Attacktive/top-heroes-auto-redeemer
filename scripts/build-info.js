import { writeFileSync, mkdirSync } from 'fs';

const buildInfo = {
	version: process.env.npm_package_version || 'unknown ☠️',
	buildTime: new Date().toISOString(),
	timestamp: Date.now()
};

const distDir = 'dist/src';
mkdirSync(distDir, { recursive: true });

writeFileSync(
	`${distDir}/build-info.json`,
	JSON.stringify(buildInfo, null, 2)
);

console.log(`📦 Build info generated: v${buildInfo.version} at ${buildInfo.buildTime}`);
