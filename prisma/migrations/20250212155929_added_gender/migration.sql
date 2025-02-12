-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "gender" TEXT,
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "username" SET DEFAULT '';
