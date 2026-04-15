-- Idempotent guard: only add if missing (MySQL 8.0.19+)
ALTER TABLE `Triage_Case`
  ADD COLUMN `ML_Status` VARCHAR(191) NULL,
  ADD COLUMN `ML_Debug` JSON NULL;
