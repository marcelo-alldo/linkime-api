-- AlterTable
ALTER TABLE `users` ADD COLUMN `partner_uid` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `partners` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_partner_uid_fkey` FOREIGN KEY (`partner_uid`) REFERENCES `partners`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
