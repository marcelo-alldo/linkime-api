/*
  Warnings:

  - Added the required column `master_uid` to the `attendant_histories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `attendant_histories` ADD COLUMN `master_uid` VARCHAR(255) NOT NULL;

-- AddForeignKey
ALTER TABLE `attendant_histories` ADD CONSTRAINT `attendant_histories_master_uid_fkey` FOREIGN KEY (`master_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;
