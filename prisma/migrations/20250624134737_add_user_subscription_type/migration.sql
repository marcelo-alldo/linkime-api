-- AlterTable
ALTER TABLE `user_subscriptions` ADD COLUMN `type` ENUM('YEARLY', 'MONTHLY') NOT NULL DEFAULT 'MONTHLY';
