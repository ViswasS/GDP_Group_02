-- CreateTable
CREATE TABLE `Case_Conversation` (
    `Conversation_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Case_ID` INTEGER NOT NULL,
    `Created_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `Updated_At` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Case_Conversation_Case_ID_key`(`Case_ID`),
    PRIMARY KEY (`Conversation_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Case_Message` (
    `Message_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Conversation_ID` INTEGER NOT NULL,
    `Sender_ID` INTEGER NOT NULL,
    `Sender_Role` VARCHAR(191) NOT NULL,
    `Content` TEXT NOT NULL,
    `Type` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `Created_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_message_conversation`(`Conversation_ID`, `Message_ID`),
    INDEX `idx_message_sender`(`Sender_ID`, `Message_ID`),
    PRIMARY KEY (`Message_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Case_Conversation` ADD CONSTRAINT `Case_Conversation_Case_ID_fkey` FOREIGN KEY (`Case_ID`) REFERENCES `Triage_Case`(`Case_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Case_Message` ADD CONSTRAINT `Case_Message_Conversation_ID_fkey` FOREIGN KEY (`Conversation_ID`) REFERENCES `Case_Conversation`(`Conversation_ID`) ON DELETE CASCADE ON UPDATE CASCADE;
