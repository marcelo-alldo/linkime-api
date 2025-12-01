/*
  Warnings:

  - You are about to drop the column `instance` on the `message_templates` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `message_templates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `message_templates` DROP COLUMN `instance`,
    DROP COLUMN `title`;
