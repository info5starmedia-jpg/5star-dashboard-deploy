/* eslint-disable no-console */
const { execSync } = require("child_process");

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

run("npx prisma generate");
run("npx prisma migrate deploy");
run("npm run -s start:next");
