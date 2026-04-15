-- Add prize name and monetary value to draws
ALTER TABLE draws ADD COLUMN prize_name TEXT;
ALTER TABLE draws ADD COLUMN prize_value INTEGER;
