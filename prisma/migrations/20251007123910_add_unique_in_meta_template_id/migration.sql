/*
  Warnings:

  - A unique constraint covering the columns `[meta_template_id]` on the table `message_templates` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `message_templates_meta_template_id_key` ON `message_templates`(`meta_template_id`);
