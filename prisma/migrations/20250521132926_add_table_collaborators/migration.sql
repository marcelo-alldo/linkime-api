-- AlterTable
ALTER TABLE `leads` MODIFY `notes` TEXT NULL;

-- CreateTable
CREATE TABLE `collaborators` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `profile_uid` VARCHAR(191) NOT NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `collaborators_profile_uid_key`(`profile_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `collaborators` ADD CONSTRAINT `collaborators_profile_uid_fkey` FOREIGN KEY (`profile_uid`) REFERENCES `data_profiles`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collaborators` ADD CONSTRAINT `collaborators_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
