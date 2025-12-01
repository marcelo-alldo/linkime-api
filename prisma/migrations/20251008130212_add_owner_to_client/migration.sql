-- AlterTable
ALTER TABLE `clients` ADD COLUMN `owner_uid` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_owner_uid_fkey` FOREIGN KEY (`owner_uid`) REFERENCES `users`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
