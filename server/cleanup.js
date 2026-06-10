const fs = require('fs');
const path = require('path');
const os = require('os');

const TEMP_DIR = os.tmpdir();

function cleanupTempFiles() {
    const files = fs.readdirSync(TEMP_DIR);

    const now = Date.now();

    files.forEach(file => {
        try {
            const filePath = path.join(TEMP_DIR, file);

            const stat = fs.statSync(filePath);

            const ageHours =
                (now - stat.mtimeMs) /
                (1000 * 60 * 60);

            if (ageHours > 1) {
                fs.unlinkSync(filePath);

                console.log(
                    `Deleted old temp file: ${file}`
                );
            }
        } catch (err) {}
    });
}

module.exports = cleanupTempFiles;