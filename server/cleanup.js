// Deletes old files from the app's OWN temp folder only (never the system temp dir).
const fs = require('fs');
const path = require('path');

function cleanupTempFiles(dir, maxAgeMinutes = 30) {
  let files;
  try { files = fs.readdirSync(dir); } catch { return; }
  const now = Date.now();
  for (const file of files) {
    try {
      const p = path.join(dir, file);
      const stat = fs.statSync(p);
      if (stat.isFile() && now - stat.mtimeMs > maxAgeMinutes * 60 * 1000) {
        fs.unlinkSync(p);
        console.log(`[cleanup] removed ${file}`);
      }
    } catch {}
  }
}

module.exports = cleanupTempFiles;
