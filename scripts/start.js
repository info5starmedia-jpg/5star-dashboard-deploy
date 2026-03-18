/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

// Docker Compose env_file may pass values with surrounding quotes
// and keys with leading whitespace. Clean both.
const cleaned = {};
for (const [key, val] of Object.entries(process.env)) {
  const cleanKey = key.trim();
  let cleanVal = val || "";
  if (/^["'].*["']$/.test(cleanVal)) {
    cleanVal = cleanVal.slice(1, -1);
  }
  cleaned[cleanKey] = cleanVal;
}
// Apply cleaned vars back to process.env
for (const [key, val] of Object.entries(cleaned)) {
  process.env[key] = val;
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npm run -s start:next");
