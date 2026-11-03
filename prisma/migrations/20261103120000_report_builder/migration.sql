CREATE TABLE `report_connections` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `clientId` CHAR(36) NULL,
  `settings` JSON NOT NULL,
  `secret` TEXT NOT NULL,
  `createdBy` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `report_connections_clientId_idx` (`clientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `report_definitions` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `clientId` CHAR(36) NOT NULL,
  `connectionId` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `definition` JSON NOT NULL,
  `createdBy` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `report_definitions_clientId_updatedAt_idx` (`clientId`, `updatedAt`),
  CONSTRAINT `report_definitions_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `report_connections` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `report_exports` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `clientId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `connectionId` CHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `rowCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  INDEX `report_exports_clientId_createdAt_idx` (`clientId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`) VALUES
  (UUID(), 'report-builder.read', 'report-builder', 'View and preview custom database reports.', NOW(3)),
  (UUID(), 'report-builder.edit', 'report-builder', 'Create, edit and delete custom database reports.', NOW(3)),
  (UUID(), 'report-builder.export', 'report-builder', 'Export custom database reports to Excel.', NOW(3)),
  (UUID(), 'report-builder.connections.manage', 'report-builder', 'Manage reporting database connections (platform administrators only).', NOW(3))
ON DUPLICATE KEY UPDATE `module` = VALUES(`module`), `description` = VALUES(`description`);

INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`, `assignedAt`)
SELECT r.id, p.id, NOW(3) FROM roles r CROSS JOIN permissions p
WHERE r.name = 'PLATFORM_SUPER_ADMIN' AND p.module = 'report-builder';
