ALTER TABLE runs ADD COLUMN deadline BIGINT NULL;
UPDATE runs SET deadline=started+86400000 WHERE deadline IS NULL;
ALTER TABLE runs MODIFY COLUMN deadline BIGINT NOT NULL;
CREATE INDEX runs_deadline ON runs(status,deadline);
