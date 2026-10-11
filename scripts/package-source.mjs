import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Ensure README and n8n and submissions are copied if available
const parentRoot = path.resolve(projectRoot, "..");
const parentReadme = path.join(parentRoot, "README.md");
const localReadme = path.join(projectRoot, "README.md");
if (!fs.existsSync(localReadme) && fs.existsSync(parentReadme)) {
  fs.copyFileSync(parentReadme, localReadme);
}

const parentCsv = path.join(parentRoot, "The Winning Team Submissions.csv");
const localCsv = path.join(projectRoot, "The Winning Team Submissions.csv");
if (!fs.existsSync(localCsv) && fs.existsSync(parentCsv)) {
  fs.copyFileSync(parentCsv, localCsv);
}

// Copy to public as well for direct URL download
if (fs.existsSync(localCsv)) {
  fs.copyFileSync(localCsv, path.join(publicDir, "The Winning Team Submissions.csv"));
  fs.copyFileSync(localCsv, path.join(publicDir, "submissions.csv"));
}

const parentN8n = path.join(parentRoot, "n8n");
const localN8n = path.join(projectRoot, "n8n");
if (!fs.existsSync(localN8n) && fs.existsSync(parentN8n)) {
  fs.cpSync(parentN8n, localN8n, { recursive: true });
}

const parentRunSubmissions = path.join(parentRoot, "Research And Implementation", "submissions", "run");
const localSubmissions = path.join(projectRoot, "submissions");
if (!fs.existsSync(localSubmissions)) {
  fs.mkdirSync(localSubmissions, { recursive: true });
}
if (fs.existsSync(parentRunSubmissions)) {
  fs.cpSync(parentRunSubmissions, localSubmissions, { recursive: true });
}
if (fs.existsSync(localCsv)) {
  fs.copyFileSync(localCsv, path.join(localSubmissions, "The Winning Team Submissions.csv"));
}

console.log("📦 Packaging website source code and submissions into public/website-source.zip...");

const zipPath = path.join(publicDir, "website-source.zip");
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Collect items to include in archive
const itemsToInclude = [
  "src",
  "worker",
  "submissions",
  "index.html",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "wrangler.jsonc",
  "components.json",
  ".gitignore",
];

if (fs.existsSync(localReadme)) itemsToInclude.push("README.md");
if (fs.existsSync(localCsv)) itemsToInclude.push('"The Winning Team Submissions.csv"');
if (fs.existsSync(localN8n)) itemsToInclude.push("n8n");

// Include all markdown files
const rootFiles = fs.readdirSync(projectRoot);
for (const file of rootFiles) {
  if (file.endsWith(".md") && !itemsToInclude.includes(file) && !itemsToInclude.includes(`"${file}"`)) {
    itemsToInclude.push(`"${file}"`);
  }
}

try {
  // Use tar with -a (auto-detect zip from extension)
  const cmd = `tar -a -c -f "${zipPath}" --exclude="node_modules" --exclude="dist" --exclude=".wrangler" --exclude="public/website-source.zip" ${itemsToInclude.join(" ")}`;
  execSync(cmd, { cwd: projectRoot, stdio: "inherit" });
} catch (e) {
  console.warn("tar failed, trying PowerShell Compress-Archive fallback...", e.message);
  const psCmd = `powershell -Command "Compress-Archive -Path ${itemsToInclude.join(", ")} -DestinationPath '${zipPath}' -Force"`;
  execSync(psCmd, { cwd: projectRoot, stdio: "inherit" });
}

if (fs.existsSync(zipPath)) {
  const stat = fs.statSync(zipPath);
  console.log(`✅ Successfully generated ${zipPath} (${(stat.size / 1024).toFixed(1)} KB)`);
} else {
  console.error("❌ Failed to create zip file!");
  process.exit(1);
}
