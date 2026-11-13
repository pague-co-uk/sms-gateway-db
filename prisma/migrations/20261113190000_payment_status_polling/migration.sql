-- UNKNOWN is unresolved: a later verified callback may still settle it.
ALTER TABLE `transactions`
  MODIFY COLUMN `status` ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED', 'UNKNOWN') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `statusPollAttempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `nextStatusPollAt` DATETIME(3) NULL;
