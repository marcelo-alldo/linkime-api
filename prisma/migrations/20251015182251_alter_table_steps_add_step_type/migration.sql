-- AlterTable
ALTER TABLE `steps` ADD COLUMN `step_type` ENUM('LEAD', 'CLIENT') NULL DEFAULT 'LEAD';
