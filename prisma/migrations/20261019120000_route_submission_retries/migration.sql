-- Existing attempts retain their timestamps and receive no scheduled time.
ALTER TABLE `message_route_attempts`
    ADD COLUMN `scheduledAt` DATETIME(3) NULL;

-- Create the replacement index before dropping the old one so the messageId
-- foreign key retains a supporting index throughout the migration.
-- A non-unique composite index supports counting attempts for a message/route.
CREATE INDEX `message_route_attempts_messageId_routeId_idx`
    ON `message_route_attempts`(`messageId`, `routeId`);

DROP INDEX `message_route_attempts_messageId_routeId_key`
    ON `message_route_attempts`;
