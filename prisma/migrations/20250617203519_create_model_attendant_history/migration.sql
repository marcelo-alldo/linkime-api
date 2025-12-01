-- CreateTable
CREATE TABLE `attendant_histories` (
    `uid` VARCHAR(191) NOT NULL,
    `remote_jid` VARCHAR(255) NOT NULL,
    `user_uid` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `note` TEXT NULL,
    `timestap` INTEGER NOT NULL,
    `transfer_to` VARCHAR(255) NULL,
    `status` ENUM('IN_PROGRESS', 'TRANSFERRED', 'FINALIZED') NOT NULL DEFAULT 'IN_PROGRESS',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendant_histories` ADD CONSTRAINT `attendant_histories_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendant_histories` ADD CONSTRAINT `attendant_histories_transfer_to_fkey` FOREIGN KEY (`transfer_to`) REFERENCES `users`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
