-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastMessage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_studentId_senderId_key" ON "Notification"("studentId", "senderId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
