ALTER TABLE `Triage_Case`
  ADD COLUMN `Doctor_Notes` TEXT NULL,
  ADD COLUMN `Doctor_Recommendation` TEXT NULL,
  ADD COLUMN `Doctor_Severity_Override` VARCHAR(191) NULL,
  ADD COLUMN `Doctor_Follow_Up_Needed` BOOLEAN NULL,
  ADD COLUMN `Doctor_Reviewed_At` DATETIME(3) NULL;
