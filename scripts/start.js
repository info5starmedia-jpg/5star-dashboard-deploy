/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

// Docker Compose env_file may pass values with surrounding quotes.
// Strip them so the app sees clean values.
for (const [key, val] of Object.entries(process.env)) {
  if (val && /^["'].*["']$/.test(val)) {
    process.env[key] = val.slice(1, -1);
  }
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npm run -s start:next");
