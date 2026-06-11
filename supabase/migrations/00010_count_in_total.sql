ALTER TABLE materials ADD COLUMN count_in_total BOOLEAN DEFAULT TRUE;
UPDATE materials SET count_in_total = TRUE WHERE count_in_total IS NULL;
