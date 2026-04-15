-- CreateTable
CREATE TABLE `User` (
    `Created_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `Email` VARCHAR(191) NOT NULL,
    `MFA_Enabled` BOOLEAN NOT NULL DEFAULT false,
    `Password` VARCHAR(191) NOT NULL,
    `Role` ENUM('ADMIN', 'DOCTOR', 'PATIENT') NOT NULL,
    `Updated_At` DATETIME(3) NOT NULL,
    `User_ID` INTEGER NOT NULL AUTO_INCREMENT,

    UNIQUE INDEX `User_Email_key`(`Email`),
    PRIMARY KEY (`User_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Admin_Profile` (
    `Admin_ID` INTEGER NOT NULL,
    `Admin_Level` VARCHAR(191) NOT NULL DEFAULT 'Data Admin',

    PRIMARY KEY (`Admin_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Doctor_Profile` (
    `Doctor_ID` INTEGER NOT NULL,
    `License_Number` VARCHAR(191) NOT NULL,
    `Specialty` VARCHAR(191) NOT NULL,
    `Experience` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Doctor_Profile_License_Number_key`(`License_Number`),
    PRIMARY KEY (`Doctor_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patient_Profile` (
    `Patient_ID` INTEGER NOT NULL,
    `Language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `Consent_Status` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`Patient_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Questionnaire` (
    `Questionnaire_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Title` VARCHAR(191) NOT NULL,
    `Is_Active` BOOLEAN NOT NULL DEFAULT true,
    `Duration` VARCHAR(191) NULL,
    `Medications` TEXT NULL,

    PRIMARY KEY (`Questionnaire_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AI_Model` (
    `Model_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Name` VARCHAR(191) NOT NULL,
    `Version` VARCHAR(191) NOT NULL,
    `Deployed_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_model_name_version`(`Name`, `Version`),
    PRIMARY KEY (`Model_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Triage_Case` (
    `Case_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Patient_ID` INTEGER NOT NULL,
    `Questionnaire_ID` INTEGER NOT NULL,
    `Is_Emergency` BOOLEAN NOT NULL DEFAULT false,
    `Doctor_ID` INTEGER NULL,
    `Status` ENUM('SUBMITTED', 'IN_REVIEW', 'CLOSED') NOT NULL DEFAULT 'SUBMITTED',
    `Submitted_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Triage_Case_Questionnaire_ID_key`(`Questionnaire_ID`),
    INDEX `idx_case_patient`(`Patient_ID`),
    INDEX `idx_case_doctor`(`Doctor_ID`),
    PRIMARY KEY (`Case_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Image` (
    `Image_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Case_ID` INTEGER NOT NULL,
    `Question_Flags` TEXT NULL,
    `Image` MEDIUMBLOB NULL,
    `Image_URL` VARCHAR(191) NULL,
    `Mime_Type` VARCHAR(191) NULL,
    `File_Size` INTEGER NULL,
    `Sha256` VARCHAR(191) NULL,
    `Uploaded_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_image_case`(`Case_ID`),
    PRIMARY KEY (`Image_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Triage_Result` (
    `Result_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Case_ID` INTEGER NOT NULL,
    `Recommendation` TEXT NOT NULL,
    `Confidence_Score` DECIMAL(5, 4) NULL,
    `Generated_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `Model_ID` INTEGER NULL,

    UNIQUE INDEX `Triage_Result_Case_ID_key`(`Case_ID`),
    INDEX `idx_result_model`(`Model_ID`),
    PRIMARY KEY (`Result_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Doctor_Review` (
    `Review_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `Case_ID` INTEGER NOT NULL,
    `Doctor_ID` INTEGER NULL,
    `Action_Notes` TEXT NOT NULL,
    `Review_Timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_review_case`(`Case_ID`),
    INDEX `idx_review_doctor`(`Doctor_ID`),
    PRIMARY KEY (`Review_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `Notification_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `User_ID` INTEGER NOT NULL,
    `Message` TEXT NOT NULL,
    `Status` ENUM('SENT', 'DELIVERED', 'READ') NOT NULL DEFAULT 'SENT',
    `Created_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_notification_user`(`User_ID`),
    PRIMARY KEY (`Notification_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Audit_Log` (
    `Audit_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `User_ID` INTEGER NULL,
    `Action` VARCHAR(191) NOT NULL,
    `Target_Table` VARCHAR(191) NULL,
    `Target_ID` INTEGER NULL,
    `Meta_Json` TEXT NULL,
    `Timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_audit_actor`(`User_ID`),
    PRIMARY KEY (`Audit_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Refresh_Token` (
    `Refresh_ID` INTEGER NOT NULL AUTO_INCREMENT,
    `User_ID` INTEGER NOT NULL,
    `Token_Hash` VARCHAR(191) NOT NULL,
    `Revoked_At` DATETIME(3) NULL,
    `Expires_At` DATETIME(3) NOT NULL,
    `Created_At` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `IP_Address` VARCHAR(191) NULL,

    UNIQUE INDEX `Refresh_Token_Token_Hash_key`(`Token_Hash`),
    INDEX `idx_refresh_user`(`User_ID`),
    PRIMARY KEY (`Refresh_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Admin_Profile` ADD CONSTRAINT `Admin_Profile_Admin_ID_fkey` FOREIGN KEY (`Admin_ID`) REFERENCES `User`(`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Doctor_Profile` ADD CONSTRAINT `Doctor_Profile_Doctor_ID_fkey` FOREIGN KEY (`Doctor_ID`) REFERENCES `User`(`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Patient_Profile` ADD CONSTRAINT `Patient_Profile_Patient_ID_fkey` FOREIGN KEY (`Patient_ID`) REFERENCES `User`(`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Triage_Case` ADD CONSTRAINT `Triage_Case_Doctor_ID_fkey` FOREIGN KEY (`Doctor_ID`) REFERENCES `Doctor_Profile`(`Doctor_ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Triage_Case` ADD CONSTRAINT `Triage_Case_Patient_ID_fkey` FOREIGN KEY (`Patient_ID`) REFERENCES `Patient_Profile`(`Patient_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Triage_Case` ADD CONSTRAINT `Triage_Case_Questionnaire_ID_fkey` FOREIGN KEY (`Questionnaire_ID`) REFERENCES `Questionnaire`(`Questionnaire_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Image` ADD CONSTRAINT `Image_Case_ID_fkey` FOREIGN KEY (`Case_ID`) REFERENCES `Triage_Case`(`Case_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Triage_Result` ADD CONSTRAINT `Triage_Result_Case_ID_fkey` FOREIGN KEY (`Case_ID`) REFERENCES `Triage_Case`(`Case_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Triage_Result` ADD CONSTRAINT `Triage_Result_Model_ID_fkey` FOREIGN KEY (`Model_ID`) REFERENCES `AI_Model`(`Model_ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Doctor_Review` ADD CONSTRAINT `Doctor_Review_Case_ID_fkey` FOREIGN KEY (`Case_ID`) REFERENCES `Triage_Case`(`Case_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Doctor_Review` ADD CONSTRAINT `Doctor_Review_Doctor_ID_fkey` FOREIGN KEY (`Doctor_ID`) REFERENCES `Doctor_Profile`(`Doctor_ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_User_ID_fkey` FOREIGN KEY (`User_ID`) REFERENCES `User`(`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Audit_Log` ADD CONSTRAINT `Audit_Log_User_ID_fkey` FOREIGN KEY (`User_ID`) REFERENCES `User`(`User_ID`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Refresh_Token` ADD CONSTRAINT `Refresh_Token_User_ID_fkey` FOREIGN KEY (`User_ID`) REFERENCES `User`(`User_ID`) ON DELETE CASCADE ON UPDATE CASCADE;

