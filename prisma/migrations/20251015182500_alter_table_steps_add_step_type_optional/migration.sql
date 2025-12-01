/*
  Warnings:

  - Made the column `step_type` on table `steps` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `steps` MODIFY `step_type` ENUM('LEAD', 'CLIENT') NOT NULL DEFAULT 'LEAD';
