-- Add optional meta JSON to case messages for AI annotations
ALTER TABLE `Case_Message`
  ADD COLUMN `Meta_Json` JSON NULL;
