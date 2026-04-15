-- Optional case enrichment + ML fields (all nullable to stay backward compatible)
ALTER TABLE `Triage_Case`
  ADD COLUMN `Rash_Location` VARCHAR(191) NULL,
  ADD COLUMN `Duration_Label` VARCHAR(191) NULL,
  ADD COLUMN `Symptoms` JSON NULL,
  ADD COLUMN `Severity` INTEGER NULL,
  ADD COLUMN `Itchiness` INTEGER NULL,
  ADD COLUMN `Spreading_Status` VARCHAR(191) NULL,
  ADD COLUMN `Triggers` TEXT NULL,
  ADD COLUMN `Image_URLs` JSON NULL,
  ADD COLUMN `ML_Image_Result` JSON NULL,
  ADD COLUMN `ML_Symptoms_Result` JSON NULL,
  ADD COLUMN `ML_Fused_Result` JSON NULL,
  ADD COLUMN `ML_Report` JSON NULL;
