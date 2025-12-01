-- AlterTable
ALTER TABLE `clients` ADD COLUMN `position` INTEGER NULL,
    ADD COLUMN `step_uid` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_step_uid_fkey` FOREIGN KEY (`step_uid`) REFERENCES `steps`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
