/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [users, auditLogs, inventoryItems, subscriptions, invoices, invoiceLineItems, stripeEvents] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.auditLog.findMany(),
      prisma.inventoryItem.findMany(),
      prisma.subscription.findMany(),
      prisma.invoice.findMany(),
      prisma.invoiceLineItem.findMany(),
      prisma.stripeEvent.findMany(),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    users,
    auditLogs,
    inventoryItems,
    subscriptions,
    invoices,
    invoiceLineItems,
    stripeEvents,
  };

  const exportDir = path.resolve(__dirname, "..", "data", "exports");
  fs.mkdirSync(exportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportPath = path.join(exportDir, `export-${stamp}.json`);

  fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2));
  console.log(`Export created: ${exportPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
