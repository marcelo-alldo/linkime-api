-- 1. Drop a foreign key constraint
ALTER TABLE `collaborators` DROP FOREIGN KEY `collaborators_parent_uid_fkey`;

-- 2. Drop the unique index
DROP INDEX `collaborators_parent_uid_key` ON `collaborators`;

-- 3. Recreate the foreign key constraint (sem unique)
ALTER TABLE `collaborators`
  ADD CONSTRAINT `collaborators_parent_uid_fkey`
  FOREIGN KEY (`parent_uid`) REFERENCES `users`(`uid`);