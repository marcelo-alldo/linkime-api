/*
  Warnings:

  - Added the required column `position` to the `leads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `leads` ADD COLUMN `position` INTEGER NOT NULL;
