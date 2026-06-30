import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

const read = (file) => readFileSync(path.join(root, file), 'utf8');
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

function assertIncludes(file, needle, message) {
  const text = read(file);
  if (!text.includes(needle)) fail(`${file}: ${message}`);
}

function assertMatches(file, pattern, message) {
  const text = read(file);
  if (!pattern.test(text)) fail(`${file}: ${message}`);
}

function assertNotMatches(file, pattern, message) {
  const text = read(file);
  if (pattern.test(text)) fail(`${file}: ${message}`);
}

assertIncludes('.gitignore', '.claude/', 'local Codex/Claude workspace metadata should stay out of public repos');
assertIncludes('.gitignore', 'android/*.keystore', 'Android keystores must be ignored');
assertIncludes('.gitignore', '*.jks', 'Java keystores must not be committed');
assertIncludes('.gitignore', '*.p12', 'PKCS12 keystores must not be committed');
assertIncludes('.gitignore', '.env.release*', 'release signing env files must not be committed');
assertIncludes('.gitignore', 'release-signing-env.ps1', 'release signing PowerShell env files must not be committed');
assertIncludes('.gitignore', '*.aab', 'release bundles must not be committed');
assertIncludes('.gitignore', '*.apk', 'APK files must not be committed');

assertMatches('android/AndroidManifest.xml', /android:allowBackup="false"/, 'Android backup must stay disabled until there is a reviewed backup/sync design');
assertNotMatches('android/AndroidManifest.xml', /android\.permission\.INTERNET/, 'offline build should not request INTERNET permission');
assertMatches('android/AndroidManifest.xml', /android\.permission\.VIBRATE/, 'VIBRATE should be the only native permission in the current offline build');
assertMatches('android/app/build.gradle', /applicationId "com\.offlineeuchre\.cardgame"/, 'release applicationId drifted');
assertMatches('js/ui.js', /applicationId:\s*'com\.offlineeuchre\.cardgame'/, 'in-app About application id drifted');

assertMatches('android/java/com/offlineeuchre/cardgame/MainActivity.java', /setAllowContentAccess\(false\)/, 'WebView content access should stay disabled');
assertMatches('android/java/com/offlineeuchre/cardgame/MainActivity.java', /setJavaScriptCanOpenWindowsAutomatically\(false\)/, 'WebView popup window creation should stay disabled');
assertMatches('android/java/com/offlineeuchre/cardgame/MainActivity.java', /removeJavascriptInterface\("NativeFeedback"\)/, 'native JS bridge should be removed on destroy');
assertMatches('android/java/com/offlineeuchre/cardgame/MainActivity.java', /@JavascriptInterface\s+public void vibrate\(String kind\)/, 'native JS bridge should expose only the reviewed haptics method');

assertMatches('docs/privacy-policy.html', /does not use accounts, cloud sync, ads, analytics, crash reporting, telemetry, online multiplayer, or a backend service/, 'hosted privacy page must match current no-network/no-SDK posture');
assertMatches('docs/privacy-policy.html', /mailto:abhotoia@gmail\.com/, 'hosted privacy page must include support email');
assertMatches('README.md', /npm run security:check/, 'release process must include the security health check');

const excludedDirs = new Set([
  '.git',
  'node_modules',
  'android/assets',
  'android/build',
  'android/app/build',
]);

const secretPatterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'private key material'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bASIA[0-9A-Z]{16}\b/, 'AWS temporary access key id'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\bghp_[0-9A-Za-z]{36,}\b/, 'GitHub personal access token'],
  [/\bgithub_pat_[0-9A-Za-z_]{80,}\b/, 'GitHub fine-grained token'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'OpenAI-style API key'],
  [/\b(storepass|keypass|storePassword|keyPassword)\s*[:=]\s*['"]?(?!android\b|testpass\b)[^\s'"]+/i, 'non-placeholder keystore password'],
];

function shouldSkip(file) {
  const normalized = file.split(path.sep).join('/');
  if (normalized === 'package-lock.json') return true;
  if (normalized.endsWith('.png') || normalized.endsWith('.jar')) return true;
  return [...excludedDirs].some((dir) => normalized === dir || normalized.startsWith(`${dir}/`));
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(root, full);
    if (shouldSkip(rel)) continue;
    const info = statSync(full);
    if (info.isDirectory()) walk(full);
    else if (info.isFile()) scanFile(rel);
  }
}

function scanFile(rel) {
  let text;
  try {
    text = readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return;
  }
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(text)) fail(`${rel}: possible ${label}`);
  }
}

walk(root);

if (warnings.length) {
  console.warn('Security health warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error('Security health check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security health check passed');
