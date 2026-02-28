/*
  Copy Vite build output into server/public so the server can serve the UI.
  Run via: npm run build (from repo root)
*/

const fs = require("fs");
const path = require("path");

function copyDir(src, dst) {
  if (!fs.existsSync(src)) throw new Error(`Source dir not found: ${src}`);
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const repoRoot = path.resolve(__dirname, "..", "..");
const clientDist = path.join(repoRoot, "client", "dist");
const serverPublic = path.join(repoRoot, "server", "public");

// Fresh copy
fs.rmSync(serverPublic, { recursive: true, force: true });
copyDir(clientDist, serverPublic);

console.log("Copied client build to server/public");
