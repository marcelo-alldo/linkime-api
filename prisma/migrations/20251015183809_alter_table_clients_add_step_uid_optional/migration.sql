/*
  Warnings:

  - Made the column `position` on table `clients` required. This step will fail if there are existing NULL values in that column.
  - Made the column `step_uid` on table `clients` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `clients` DROP FOREIGN KEY `clients_step_uid_fkey`;

-- AlterTable
ALTER TABLE `clients` MODIFY `position` INTEGER NOT NULL,
    MODIFY `step_uid` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_step_uid_fkey` FOREIGN KEY (`step_uid`) REFERENCES `steps`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
