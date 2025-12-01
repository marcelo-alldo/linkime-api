-- CreateTable
CREATE TABLE `users` (
    `uid` VARCHAR(191) NOT NULL,
    `login` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `token_firebase` VARCHAR(255) NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `activation_code` VARCHAR(255) NULL,
    `recovery_code` VARCHAR(255) NULL,
    `first_login` BOOLEAN NOT NULL DEFAULT false,
    `confirmed` BOOLEAN NOT NULL DEFAULT false,
    `type` INTEGER NOT NULL DEFAULT 2,
    `profile_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_login_key`(`login`),
    UNIQUE INDEX `users_profile_uid_key`(`profile_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_configs` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `alldo_payment_uid` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'RECEIVED', 'CANCELED', 'CONFIRMED', 'OVERDUE', 'REFUNDED', 'REFUSED', 'RECEIVED_IN_CASH', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'DUNNING_REQUESTED', 'DUNNING_RECEIVED', 'AWAITING_RISK_ANALYSIS') NOT NULL DEFAULT 'PENDING',
    `type` ENUM('BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'DEPOSIT', 'PIX') NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `due_date` DATETIME(3) NOT NULL,
    `discount` FLOAT NULL,
    `discount_type` ENUM('PERCENTAGE', 'VALUE') NULL,
    `code_pix` VARCHAR(255) NULL,
    `source` ENUM('ASAAS', 'IZIPAY') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_alldo_payment_uid_key`(`alldo_payment_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_profiles` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(16) NULL,
    `ie_rg` VARCHAR(50) NULL,
    `cpf` VARCHAR(14) NULL,
    `cnpj` VARCHAR(18) NULL,
    `fantasy_name` VARCHAR(255) NULL,
    `birth_date` DATETIME(3) NULL,
    `avatar` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `address_uid` VARCHAR(191) NULL,

    UNIQUE INDEX `data_profiles_email_key`(`email`),
    UNIQUE INDEX `data_profiles_ie_rg_key`(`ie_rg`),
    UNIQUE INDEX `data_profiles_cpf_key`(`cpf`),
    UNIQUE INDEX `data_profiles_cnpj_key`(`cnpj`),
    UNIQUE INDEX `data_profiles_address_uid_key`(`address_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_credit_cards` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `card_name` VARCHAR(191) NULL,
    `credit_card_number` VARCHAR(191) NOT NULL,
    `credit_card_brand` VARCHAR(191) NOT NULL,
    `credit_card_token` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` INTEGER NOT NULL,
    `description` VARCHAR(150) NOT NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `features` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(150) NOT NULL,
    `endpoint` VARCHAR(150) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `features_name_key`(`name`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_features` (
    `uid` VARCHAR(191) NOT NULL,
    `role_uid` VARCHAR(191) NOT NULL,
    `feature_uid` VARCHAR(191) NOT NULL,
    `actions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_features` (
    `uid` VARCHAR(191) NOT NULL,
    `role_uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `feature_uid` VARCHAR(191) NOT NULL,
    `actions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `addresses` (
    `uid` VARCHAR(191) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `number` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NULL,
    `complement` VARCHAR(255) NULL,
    `neighborhood` VARCHAR(255) NOT NULL,
    `zipCode` VARCHAR(9) NOT NULL,
    `latitude` VARCHAR(255) NOT NULL,
    `longitude` VARCHAR(255) NOT NULL,
    `point` VARCHAR(255) NOT NULL,
    `city_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cities` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code_ibge` INTEGER NOT NULL,
    `state_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `states` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code_ibge` INTEGER NOT NULL,
    `country_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `initials` VARCHAR(255) NOT NULL,
    `m49` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `uid` VARCHAR(191) NOT NULL,
    `key` TEXT NOT NULL,
    `public_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_supportes` (
    `uid` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `status` ENUM('FINALIZED', 'IN_PROGRESS', 'NOT_STARTED') NOT NULL DEFAULT 'NOT_STARTED',
    `solution` VARCHAR(255) NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `user_responsible_uid` VARCHAR(191) NULL,
    `product_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `role_uid` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_subscriptions` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `subscription_uid` VARCHAR(191) NOT NULL,
    `payment_uid` VARCHAR(191) NULL,
    `status` ENUM('TRIAL', 'PAYMENT_PENDING', 'ACTIVE', 'CANCELED', 'EXPIRED') NOT NULL DEFAULT 'PAYMENT_PENDING',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(16) NOT NULL,
    `ie_rg` VARCHAR(50) NULL,
    `cpf` VARCHAR(14) NULL,
    `cnpj` VARCHAR(18) NULL,
    `fantasy_name` VARCHAR(255) NULL,
    `birth_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_email_key`(`email`),
    UNIQUE INDEX `leads_ie_rg_key`(`ie_rg`),
    UNIQUE INDEX `leads_cpf_key`(`cpf`),
    UNIQUE INDEX `leads_cnpj_key`(`cnpj`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `uid` VARCHAR(191) NOT NULL,
    `user_uid` VARCHAR(191) NOT NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `data_profile_uid` VARCHAR(191) NOT NULL,
    `address_uid` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_data_profile_uid_key`(`data_profile_uid`),
    UNIQUE INDEX `clients_address_uid_key`(`address_uid`),
    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `steps` (
    `uid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `user_uid` VARCHAR(191) NULL,
    `type` VARCHAR(255) NOT NULL DEFAULT 'DEFAULT',
    `description` VARCHAR(255) NULL,
    `enable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`uid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_profile_uid_fkey` FOREIGN KEY (`profile_uid`) REFERENCES `data_profiles`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_configs` ADD CONSTRAINT `user_configs_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_profiles` ADD CONSTRAINT `data_profiles_address_uid_fkey` FOREIGN KEY (`address_uid`) REFERENCES `addresses`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_credit_cards` ADD CONSTRAINT `user_credit_cards_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_features` ADD CONSTRAINT `role_features_feature_uid_fkey` FOREIGN KEY (`feature_uid`) REFERENCES `features`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_features` ADD CONSTRAINT `role_features_role_uid_fkey` FOREIGN KEY (`role_uid`) REFERENCES `roles`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_features` ADD CONSTRAINT `user_features_feature_uid_fkey` FOREIGN KEY (`feature_uid`) REFERENCES `features`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_features` ADD CONSTRAINT `user_features_role_uid_fkey` FOREIGN KEY (`role_uid`) REFERENCES `roles`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_features` ADD CONSTRAINT `user_features_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_city_uid_fkey` FOREIGN KEY (`city_uid`) REFERENCES `cities`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cities` ADD CONSTRAINT `cities_state_uid_fkey` FOREIGN KEY (`state_uid`) REFERENCES `states`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `states` ADD CONSTRAINT `states_country_uid_fkey` FOREIGN KEY (`country_uid`) REFERENCES `countries`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_supportes` ADD CONSTRAINT `ticket_supportes_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_supportes` ADD CONSTRAINT `ticket_supportes_user_responsible_uid_fkey` FOREIGN KEY (`user_responsible_uid`) REFERENCES `users`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_uid_fkey` FOREIGN KEY (`role_uid`) REFERENCES `roles`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_subscription_uid_fkey` FOREIGN KEY (`subscription_uid`) REFERENCES `subscriptions`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_data_profile_uid_fkey` FOREIGN KEY (`data_profile_uid`) REFERENCES `data_profiles`(`uid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_address_uid_fkey` FOREIGN KEY (`address_uid`) REFERENCES `addresses`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `steps` ADD CONSTRAINT `steps_user_uid_fkey` FOREIGN KEY (`user_uid`) REFERENCES `users`(`uid`) ON DELETE SET NULL ON UPDATE CASCADE;
