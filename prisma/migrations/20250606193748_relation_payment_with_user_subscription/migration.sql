/*
  Warnings:

  - You are about to drop the column `payment_uid` on the `user_subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payments` ADD COLUMN `subscription_uid` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user_subscriptions` DROP COLUMN `payment_uid`;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscription_uid_fkey` FOREIGN KEY (`subscription_uid`) REFERENCES `user_subscriptions`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
