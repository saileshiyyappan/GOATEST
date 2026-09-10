import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const home = resolve(process.cwd());
const root = resolve(home, '..');
const resultsDir = resolve(root, 'qa-results');
const apk = resolve(home, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const packageName = 'com.goatest.app';
const activity = `${packageName}/.MainActivity`;
const device = process.env.ANDROID_SERIAL || 'emulator-5554';

function run(command, args, options = {}) {
  const isBatch = command.endsWith('.bat');
  const executable = isBatch ? 'powershell.exe' : command;
  const executableArgs = isBatch
    ? ['-NoProfile', '-NonInteractive', '-Command', `& .\\${command} ${args.map((arg) => `"${arg}"`).join(' ')}`
    ]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd: options.cwd || home,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: !isBatch && command.endsWith('.cmd'),
    stdio: options.capture === false ? 'inherit' : 'pipe',
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.error?.message ?? 'unknown'}): ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout || '';
}

function adb(args) {
  return run('adb', ['-s', device, ...args]);
}

function fail(message, details = {}) {
  mkdirSync(resultsDir, { recursive: true });
  const result = {
    timestamp: new Date().toISOString(),
    device,
    status: 'FAIL',
    total: 0,
    passed: 0,
    failed: 1,
    blocked: 0,
    error: message,
    ...details,
  };
  writeFileSync(resolve(resultsDir, 'android-e2e-result.json'), JSON.stringify(result, null, 2));
  writeFileSync(resolve(resultsDir, 'android-e2e-report.md'), `# Android E2E FAILED\n\n${message}\n`);
  console.error(`FAIL — ${message}`);
  process.exitCode = 1;
}

try {
  const devices = run('adb', ['devices']).split(/\r?\n/).filter((line) => line.endsWith('\tdevice'));
  if (!devices.some((line) => line.startsWith(`${device}\t`))) {
    fail('NO ANDROID DEVICE', { devices });
    process.exit();
  }

  run('npm.cmd', ['run', 'build:android:qa']);
  run('npm.cmd', ['exec', '--', 'cap', 'sync', 'android']);
  run('gradlew.bat', ['assembleDebug', '--no-daemon'], { cwd: resolve(home, 'android') });
  if (!existsSync(apk)) throw new Error(`APK not found: ${apk}`);

  adb(['install', '-r', apk]);
  adb(['logcat', '-c']);
  adb(['shell', 'am', 'force-stop', packageName]);
  adb(['shell', 'monkey', '-p', packageName, '1']);

  let logcat = '';
  let payload = null;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    logcat = adb(['logcat', '-d', '-v', 'brief']);
    const marker = logcat.match(/GOATEST_ANDROID_E2E_RESULT\s+(\{.*\})/);
    if (marker) {
      try {
        payload = JSON.parse(marker[1]);
      } catch {
        // The WebView may split a long line; continue polling until complete.
      }
    }
    if (payload) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }

  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(resolve(resultsDir, 'android-e2e-logcat.txt'), logcat);
  if (!payload) {
    fail('CONTROLLED ANDROID E2E TIMEOUT', {
      build: 'PASS',
      install: 'PASS',
      launch: 'PASS',
      runtimeErrors: (logcat.match(/FATAL EXCEPTION|ANR in|WebView render process gone/g) || []),
    });
    process.exit();
  }

  const runtimeErrors = logcat.match(/FATAL EXCEPTION|ANR in|WebView render process gone|GOATEST_JS_ERROR|GOATEST_JS_REJECTION/g) || [];
  const result = {
    timestamp: new Date().toISOString(),
    device,
    apk: apk,
    build: 'PASS',
    install: 'PASS',
    launch: 'PASS',
    runtimeErrors,
    ...payload,
    status: payload.status === 'PASS' && runtimeErrors.length === 0 ? 'PASS' : 'FAIL',
  };
  writeFileSync(resolve(resultsDir, 'android-e2e-result.json'), JSON.stringify(result, null, 2));

  const matrix = payload.lockMatrix.map((item) =>
    `| ${item.shake} | ${item.event} | ${item.expected} | ${item.actual} | ${item.passed ? 'PASS' : 'FAIL'} |`
  ).join('\n');
  const report = [
    '# BAND CONTROLLED ANDROID E2E REPORT',
    '',
    `- Device: ${device}`,
    '- Build: PASS',
    '- Install: PASS',
    '- Launch: PASS',
    '',
    '## Lock Matrix',
    '',
    '| Shake | Event | Expected | Actual | Result |',
    '|---:|---:|---|---|---|',
    matrix,
    '',
    `- Total: ${payload.total}`,
    `- Passed: ${payload.passed}`,
    `- Failed: ${payload.failed}`,
    `- Runtime errors: ${runtimeErrors.length ? runtimeErrors.join(', ') : 'none'}`,
    `- Full E2E: ${JSON.stringify(payload.endToEnd)}`,
    '',
    `## Final status: ${result.status}`,
  ].join('\n');
  writeFileSync(resolve(resultsDir, 'android-e2e-report.md'), report);
  console.log(`ANDROID_E2E_${result.status}`);
  if (result.status !== 'PASS') process.exitCode = 1;
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
