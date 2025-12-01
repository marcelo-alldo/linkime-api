-- AlterTable
ALTER TABLE `leads` ADD COLUMN `stepUid` VARCHAR(255) NULL;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_stepUid_fkey` FOREIGN KEY (`stepUid`) REFERENCES `steps`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
