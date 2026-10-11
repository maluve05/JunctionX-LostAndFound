import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const zip = new JSZip();

// Ignore patterns
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-ssr",
  ".git",
  ".wrangler",
  ".vite",
  "scratch",
]);

const IGNORED_FILES = new Set([
  "website-source.zip",
  ".DS_Store",
]);

function shouldIncludeFile(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const parts = norm.split("/");

  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return false;
  }

  const base = parts[parts.length - 1];
  if (IGNORED_FILES.has(base)) return false;
  if (base.endsWith(".log")) return false;
  if (/apikey|secret|\.env/i.test(base)) return false;

  return true;
}

function addDirectoryToZip(dirPath, zipFolder, baseDir) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (!shouldIncludeFile(relPath)) continue;

    if (entry.isDirectory()) {
      const subFolder = zipFolder.folder(entry.name);
      addDirectoryToZip(fullPath, subFolder, baseDir);
    } else if (entry.isFile()) {
      const fileData = fs.readFileSync(fullPath);
      zipFolder.file(entry.name, fileData);
    }
  }
}

async function main() {
  console.log("📦 Packaging website source code into public/website-source.zip...");
  const publicDir = path.join(projectRoot, "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Ensure README and n8n are present in website root if available in parent repo
  const parentRoot = path.resolve(projectRoot, "..");
  const parentReadme = path.join(parentRoot, "README.md");
  const localReadme = path.join(projectRoot, "README.md");
  if (!fs.existsSync(localReadme) && fs.existsSync(parentReadme)) {
    fs.copyFileSync(parentReadme, localReadme);
  }

  const parentN8n = path.join(parentRoot, "n8n");
  const localN8n = path.join(projectRoot, "n8n");
  if (!fs.existsSync(localN8n) && fs.existsSync(parentN8n)) {
    fs.cpSync(parentN8n, localN8n, { recursive: true });
  }

  // Add all files from project root
  addDirectoryToZip(projectRoot, zip, projectRoot);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const outPath = path.join(publicDir, "website-source.zip");
  fs.writeFileSync(outPath, zipBuffer);

  const sizeKb = (zipBuffer.length / 1024).toFixed(1);
  console.log(`✅ Successfully generated ${outPath} (${sizeKb} KB)`);
}

main().catch((err) => {
  console.error("❌ Failed to package source code:", err);
  process.exit(1);
});
