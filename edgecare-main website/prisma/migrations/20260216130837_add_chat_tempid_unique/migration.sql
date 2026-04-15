/*
  Warnings:

  - A unique constraint covering the columns `[Conversation_ID,Temp_ID]` on the table `Case_Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Case_Message` ADD COLUMN `Temp_ID` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `uq_msg_temp_per_convo` ON `Case_Message`(`Conversation_ID`, `Temp_ID`);
