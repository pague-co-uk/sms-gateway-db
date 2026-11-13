-- Expand only. Historical and already queued payments remain valid.
-- Do not infer destination country from senderCountryCode for cross-border payouts.
ALTER TABLE `transactions`
  ADD COLUMN `accountNumber` VARCHAR(100) NULL,
  ADD COLUMN `country` CHAR(2) NULL;
