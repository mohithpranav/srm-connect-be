-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_connectionId_fkey";

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "connectionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
