import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function installDependency() {
  console.log('Installing @garmin/fitsdk@21.213.0...');
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['install', '--no-save', '@garmin/fitsdk@21.213.0'], {
      cwd: __dirname,
      stdio: 'inherit',
    });
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('Dependency installed successfully');
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });
  });
}

async function runTests() {
  console.log('Running tests...');
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['--test', 'src/fit/parseFitFile.test.ts'], {
      cwd: __dirname,
      stdio: 'inherit',
    });
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('Tests passed');
        resolve();
      } else {
        reject(new Error(`Tests failed with code ${code}`));
      }
    });
  });
}

(async () => {
  try {
    await installDependency();
    await runTests();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
