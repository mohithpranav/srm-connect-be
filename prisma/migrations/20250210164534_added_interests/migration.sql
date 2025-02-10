-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];
