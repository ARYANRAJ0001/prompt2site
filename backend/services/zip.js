const archiver = require("archiver");

/** Zip a { "path": "contents" } map (or a folder) into a Buffer. */
function zipFiles(files, { folder } = {}) {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("data", (c) => chunks.push(c));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    if (folder) archive.directory(folder, false);
    else for (const [p, content] of Object.entries(files)) archive.append(content ?? "", { name: p });
    archive.finalize();
  });
}

module.exports = { zipFiles };
