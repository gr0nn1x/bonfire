const fs = require("node:fs");
const path = require("node:path");

const requiredExports = {
  "./src/*": "./src/*.js",
  "./src/*.js": "./src/*.js",
};

const nodeModulesPath = path.join(__dirname, "..", "node_modules");

if (!fs.existsSync(nodeModulesPath)) {
  process.exit(0);
}

for (const entry of fs.readdirSync(nodeModulesPath, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith("metro")) {
    continue;
  }

  const packageJsonPath = path.join(
    nodeModulesPath,
    entry.name,
    "package.json",
  );

  if (!fs.existsSync(packageJsonPath)) {
    continue;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  packageJson.exports = {
    ...packageJson.exports,
    ...requiredExports,
  };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
