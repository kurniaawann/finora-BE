-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `email_verified_at` DATETIME(0) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_users_email`(`email`),
    INDEX `idx_users_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profiles` (
    `user_id` VARCHAR(36) NOT NULL,
    `username` VARCHAR(50) NULL,
    `full_name` VARCHAR(255) NULL,
    `avatar_url` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `bio` TEXT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'IDR',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `uk_profiles_username`(`username`),
    INDEX `idx_profiles_user_id`(`user_id`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,
    `revoked_at` DATETIME(0) NULL,
    `replaced_by_token_id` VARCHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_refresh_tokens_hash`(`token_hash`),
    INDEX `idx_refresh_tokens_user_id`(`user_id`),
    INDEX `idx_refresh_tokens_expires_at`(`expires_at`),
    INDEX `fk_refresh_tokens_replaced_by`(`replaced_by_token_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('cash', 'bank', 'e_wallet', 'credit_card', 'investment', 'other') NOT NULL,
    `institution_name` VARCHAR(255) NULL,
    `account_number_masked` VARCHAR(255) NULL,
    `initial_balance` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `currency` CHAR(3) NOT NULL DEFAULT 'IDR',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `include_in_total_balance` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_accounts_active`(`user_id`, `is_active`),
    INDEX `idx_accounts_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NULL,
    `parent_id` VARCHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('income', 'expense') NOT NULL,
    `icon` VARCHAR(100) NULL,
    `color` VARCHAR(50) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_categories_parent_id`(`parent_id`),
    INDEX `idx_categories_type`(`type`),
    INDEX `idx_categories_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `owner_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('personal', 'club', 'trip', 'household', 'project', 'event', 'other') NOT NULL DEFAULT 'other',
    `avatar_url` TEXT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'IDR',
    `invite_code` VARCHAR(50) NOT NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `invite_code`(`invite_code`),
    INDEX `idx_groups_owner_id`(`owner_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_members` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `event_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_event_members_event_id`(`event_id`),
    INDEX `idx_event_members_user_id`(`user_id`),
    UNIQUE INDEX `uk_event_user`(`event_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `group_id` VARCHAR(36) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `location` VARCHAR(255) NULL,
    `start_date` DATETIME(0) NULL,
    `end_date` DATETIME(0) NULL,
    `status` ENUM('planning', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'planning',
    `budget` DECIMAL(18, 2) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_events_created_by`(`created_by`),
    INDEX `idx_events_group_id`(`group_id`),
    INDEX `idx_events_start_date`(`start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_item_members` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `expense_item_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `guest_name` VARCHAR(255) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 1.0000,
    `amount` DECIMAL(18, 2) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_expense_item_members_item_id`(`expense_item_id`),
    INDEX `idx_expense_item_members_user_id`(`user_id`),
    UNIQUE INDEX `idx_expense_item_members_user_unique`(`expense_item_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_items` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `expense_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL DEFAULT 1.0000,
    `unit_price` DECIMAL(18, 2) NOT NULL,
    `total_amount` DECIMAL(18, 2) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_expense_items_expense_id`(`expense_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_members` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `expense_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `guest_name` VARCHAR(255) NULL,
    `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `percentage` DECIMAL(7, 4) NULL,
    `shares` DECIMAL(18, 4) NULL,
    `is_payer` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_expense_members_expense_id`(`expense_id`),
    INDEX `idx_expense_members_user_id`(`user_id`),
    UNIQUE INDEX `idx_expense_members_user_unique`(`expense_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_payments` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `expense_id` VARCHAR(36) NOT NULL,
    `payer_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `payment_method_id` VARCHAR(36) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `status` ENUM('pending', 'submitted', 'confirmed', 'rejected', 'cancelled') NOT NULL DEFAULT 'confirmed',
    `paid_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `note` TEXT NULL,
    `proof_url` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `fk_expense_payments_pm`(`payment_method_id`),
    INDEX `idx_expense_payments_account_id`(`account_id`),
    INDEX `idx_expense_payments_expense_id`(`expense_id`),
    INDEX `idx_expense_payments_payer_id`(`payer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `group_id` VARCHAR(36) NOT NULL,
    `event_id` VARCHAR(36) NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('food', 'transport', 'shopping', 'entertainment', 'accommodation', 'travel', 'bills', 'health', 'education', 'other') NOT NULL DEFAULT 'other',
    `total_amount` DECIMAL(18, 2) NOT NULL,
    `split_method` ENUM('equal', 'exact', 'percentage', 'shares', 'item') NOT NULL DEFAULT 'equal',
    `status` ENUM('draft', 'active', 'settled', 'cancelled') NOT NULL DEFAULT 'draft',
    `expense_date` DATE NOT NULL DEFAULT (curdate()),
    `receipt_url` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `fk_expenses_event`(`event_id`),
    INDEX `idx_expenses_created_by`(`created_by`),
    INDEX `idx_expenses_date_status`(`expense_date`, `status`),
    INDEX `idx_expenses_group_id`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `group_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `role` ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
    `nickname` VARCHAR(255) NULL,
    `joined_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_group_members_group_id`(`group_id`),
    INDEX `idx_group_members_user_id`(`user_id`),
    UNIQUE INDEX `uk_group_user`(`group_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invitations` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `group_id` VARCHAR(36) NOT NULL,
    `inviter_id` VARCHAR(36) NOT NULL,
    `invitee_id` VARCHAR(36) NULL,
    `email` VARCHAR(255) NULL,
    `token` VARCHAR(64) NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
    `expires_at` DATETIME(0) NULL,
    `accepted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `token`(`token`),
    INDEX `fk_invitations_inviter`(`inviter_id`),
    INDEX `idx_invitations_group_id`(`group_id`),
    INDEX `idx_invitations_invitee_id`(`invitee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('cash', 'bank_transfer', 'e_wallet', 'card', 'other') NOT NULL,
    `provider` VARCHAR(255) NULL,
    `account_id` VARCHAR(36) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `fk_payment_methods_account`(`account_id`),
    INDEX `idx_payment_methods_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `group_id` VARCHAR(36) NOT NULL,
    `from_user_id` VARCHAR(36) NOT NULL,
    `to_user_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `payment_method_id` VARCHAR(36) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `settled_at` DATETIME(0) NULL,
    `note` TEXT NULL,
    `proof_url` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `fk_settlements_account`(`account_id`),
    INDEX `fk_settlements_pm`(`payment_method_id`),
    INDEX `fk_settlements_to_user`(`to_user_id`),
    INDEX `idx_settlements_group_id`(`group_id`),
    INDEX `idx_settlements_status`(`status`),
    INDEX `idx_settlements_users`(`from_user_id`, `to_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NULL,
    `action` VARCHAR(255) NOT NULL,
    `table_name` VARCHAR(255) NOT NULL,
    `record_id` VARCHAR(36) NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_audit_logs_created_at`(`created_at`),
    INDEX `idx_audit_logs_table_record`(`table_name`, `record_id`),
    INDEX `idx_audit_logs_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_categories` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `budget_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_budget_categories_budget_id`(`budget_id`),
    INDEX `idx_budget_categories_category_id`(`category_id`),
    UNIQUE INDEX `uk_budget_category`(`budget_id`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budgets` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_budgets_dates`(`user_id`, `start_date`, `end_date`),
    INDEX `idx_budgets_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `type` ENUM('expense', 'payment', 'settlement', 'invitation', 'budget', 'savings', 'recurring', 'system') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `data` JSON NOT NULL,
    `read_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_notifications_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recurring_transactions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `category_id` VARCHAR(36) NULL,
    `type` ENUM('income', 'expense', 'transfer', 'refund', 'adjustment') NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `frequency` ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `next_run_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `fk_recurring_account`(`account_id`),
    INDEX `fk_recurring_category`(`category_id`),
    INDEX `idx_recurring_next_run`(`next_run_date`, `is_active`),
    INDEX `idx_recurring_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `savings_contributions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `goal_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `contribution_date` DATE NOT NULL DEFAULT (curdate()),
    `note` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_savings_contributions_acc`(`account_id`),
    INDEX `idx_savings_contributions_goal_id`(`goal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `savings_goals` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `target_amount` DECIMAL(18, 2) NOT NULL,
    `target_date` DATE NULL,
    `icon` VARCHAR(100) NULL,
    `color` VARCHAR(50) NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_savings_goals_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `account_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NULL,
    `type` ENUM('income', 'expense', 'transfer', 'refund', 'adjustment') NOT NULL,
    `status` ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'completed',
    `amount` DECIMAL(18, 2) NOT NULL,
    `transaction_date` DATE NOT NULL DEFAULT (curdate()),
    `description` TEXT NULL,
    `merchant` VARCHAR(255) NULL,
    `reference_number` VARCHAR(255) NULL,
    `expense_payment_id` VARCHAR(36) NULL,
    `settlement_id` VARCHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `expense_payment_id`(`expense_payment_id`),
    UNIQUE INDEX `settlement_id`(`settlement_id`),
    INDEX `fk_transactions_account`(`account_id`),
    INDEX `fk_transactions_category`(`category_id`),
    INDEX `idx_transactions_user_account`(`user_id`, `account_id`),
    INDEX `idx_transactions_user_date`(`user_id`, `transaction_date`),
    INDEX `idx_transactions_user_type`(`user_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfers` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `from_account_id` VARCHAR(36) NOT NULL,
    `to_account_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `transfer_date` DATE NOT NULL DEFAULT (curdate()),
    `note` TEXT NULL,
    `from_transaction_id` VARCHAR(36) NULL,
    `to_transaction_id` VARCHAR(36) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_transfers_from_acc`(`from_account_id`),
    INDEX `fk_transfers_from_tx`(`from_transaction_id`),
    INDEX `fk_transfers_to_acc`(`to_account_id`),
    INDEX `fk_transfers_to_tx`(`to_transaction_id`),
    INDEX `idx_transfers_date`(`user_id`, `transfer_date`),
    INDEX `idx_transfers_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `fk_refresh_tokens_replaced_by` FOREIGN KEY (`replaced_by_token_id`) REFERENCES `refresh_tokens`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `fk_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `fk_categories_parent` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `fk_categories_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `event_members` ADD CONSTRAINT `fk_event_members_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `event_members` ADD CONSTRAINT `fk_event_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `fk_events_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `fk_events_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_item_members` ADD CONSTRAINT `fk_expense_item_members_item` FOREIGN KEY (`expense_item_id`) REFERENCES `expense_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_item_members` ADD CONSTRAINT `fk_expense_item_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_items` ADD CONSTRAINT `fk_expense_items_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_members` ADD CONSTRAINT `fk_expense_members_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_members` ADD CONSTRAINT `fk_expense_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_payments` ADD CONSTRAINT `fk_expense_payments_account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_payments` ADD CONSTRAINT `fk_expense_payments_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_payments` ADD CONSTRAINT `fk_expense_payments_payer` FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expense_payments` ADD CONSTRAINT `fk_expense_payments_pm` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `fk_expenses_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `fk_group_members_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `fk_invitations_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `fk_invitations_invitee` FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `fk_invitations_inviter` FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payment_methods` ADD CONSTRAINT `fk_payment_methods_account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payment_methods` ADD CONSTRAINT `fk_payment_methods_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `fk_settlements_account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `fk_settlements_from_user` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `fk_settlements_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `fk_settlements_pm` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `fk_settlements_to_user` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `budget_categories` ADD CONSTRAINT `fk_budget_categories_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `budget_categories` ADD CONSTRAINT `fk_budget_categories_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `budgets` ADD CONSTRAINT `fk_budgets_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `recurring_transactions` ADD CONSTRAINT `fk_recurring_account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `recurring_transactions` ADD CONSTRAINT `fk_recurring_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `recurring_transactions` ADD CONSTRAINT `fk_recurring_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `savings_contributions` ADD CONSTRAINT `fk_savings_contributions_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `savings_contributions` ADD CONSTRAINT `fk_savings_contributions_goal` FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `savings_goals` ADD CONSTRAINT `fk_savings_goals_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_category` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_exp_payment` FOREIGN KEY (`expense_payment_id`) REFERENCES `expense_payments`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_settlement` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_from_acc` FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_from_tx` FOREIGN KEY (`from_transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_to_acc` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_to_tx` FOREIGN KEY (`to_transaction_id`) REFERENCES `transactions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

