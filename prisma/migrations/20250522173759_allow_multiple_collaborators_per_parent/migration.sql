-- DropForeignKey
ALTER TABLE `collaborators` DROP FOREIGN KEY `collaborators_parent_uid_fkey`;

-- AddForeignKey
ALTER TABLE `collaborators` ADD CONSTRAINT `collaborators_parent_uid_fkey` FOREIGN KEY (`parent_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
