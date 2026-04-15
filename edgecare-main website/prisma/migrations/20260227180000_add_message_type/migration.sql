-- Add messageType to case messages for AI summary classification
ALTER TABLE `Case_Message`
  ADD COLUMN `Message_Type` VARCHAR(50) NOT NULL DEFAULT 'USER';
