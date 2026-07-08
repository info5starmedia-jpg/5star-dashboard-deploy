-- AlterTable: add content field to InventoryItem (stores proxy lines, one per line)
ALTER TABLE "InventoryItem" ADD COLUMN "content" TEXT;

-- AlterTable: add deliveredContent field to InvoiceLineItem (stores assigned proxy lines)
ALTER TABLE "InvoiceLineItem" ADD COLUMN "deliveredContent" TEXT;
