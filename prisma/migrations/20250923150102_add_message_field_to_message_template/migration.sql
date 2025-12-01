/*
  Warnings:

  - Added the required column `message` to the `message_templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `message_templates` ADD COLUMN `message` TEXT NOT NULL;
