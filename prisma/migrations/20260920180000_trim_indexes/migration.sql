-- Consolidate indexes: max 3 per table (PK + mandatory FK/unique not included)

-- refresh_tokens: drop expires_at (cleanup scan ok without it)
DROP INDEX `idx_refresh_tokens_expires_at` ON `refresh_tokens`;

-- users: drop is_active
DROP INDEX `idx_users_active` ON `users`;

-- accounts: drop (user_id, is_active), keep idx_accounts_user_id
ALTER TABLE `accounts` DROP FOREIGN KEY `fk_accounts_user`;
DROP INDEX `idx_accounts_active` ON `accounts`;
ALTER TABLE `accounts` ADD CONSTRAINT `fk_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- profiles: user_id is PK, redundant index
ALTER TABLE `profiles` DROP FOREIGN KEY `fk_profiles_user`;
DROP INDEX `idx_profiles_user_id` ON `profiles`;
ALTER TABLE `profiles` ADD CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- budgets: keep composite (user_id, start_date, end_date) which covers FK
ALTER TABLE `budgets` DROP FOREIGN KEY `fk_budgets_user`;
DROP INDEX `idx_budgets_user_id` ON `budgets`;
ALTER TABLE `budgets` ADD CONSTRAINT `fk_budgets_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- budget_categories: keep unique (budget_id, category_id) which covers FK budget_id
ALTER TABLE `budget_categories` DROP FOREIGN KEY `fk_budget_categories_budget`;
DROP INDEX `idx_budget_categories_budget_id` ON `budget_categories`;
ALTER TABLE `budget_categories` ADD CONSTRAINT `fk_budget_categories_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- event_members: keep unique (event_id, user_id) which covers FK event_id
ALTER TABLE `event_members` DROP FOREIGN KEY `fk_event_members_event`;
DROP INDEX `idx_event_members_event_id` ON `event_members`;
ALTER TABLE `event_members` ADD CONSTRAINT `fk_event_members_event` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- group_members: keep unique (group_id, user_id) which covers FK group_id
ALTER TABLE `group_members` DROP FOREIGN KEY `fk_group_members_group`;
DROP INDEX `idx_group_members_group_id` ON `group_members`;
ALTER TABLE `group_members` ADD CONSTRAINT `fk_group_members_group` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- expense_members: keep unique (expense_id, user_id) which covers FK expense_id
ALTER TABLE `expense_members` DROP FOREIGN KEY `fk_expense_members_expense`;
DROP INDEX `idx_expense_members_expense_id` ON `expense_members`;
ALTER TABLE `expense_members` ADD CONSTRAINT `fk_expense_members_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- expense_item_members: keep unique (expense_item_id, user_id) which covers FK expense_item_id
ALTER TABLE `expense_item_members` DROP FOREIGN KEY `fk_expense_item_members_item`;
DROP INDEX `idx_expense_item_members_item_id` ON `expense_item_members`;
ALTER TABLE `expense_item_members` ADD CONSTRAINT `fk_expense_item_members_item` FOREIGN KEY (`expense_item_id`) REFERENCES `expense_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- expenses: drop date_status
DROP INDEX `idx_expenses_date_status` ON `expenses`;

-- recurring_transactions: drop next_run
DROP INDEX `idx_recurring_next_run` ON `recurring_transactions`;

-- savings_contributions: drop status
DROP INDEX `idx_savings_contributions_status` ON `savings_contributions`;

-- settlements: drop status
DROP INDEX `idx_settlements_status` ON `settlements`;

-- transactions: keep account, category, (user_id, transaction_date) + 3 unique FK links
ALTER TABLE `transactions` DROP FOREIGN KEY `fk_transactions_user`;
DROP INDEX `idx_transactions_user_account` ON `transactions`;
DROP INDEX `idx_transactions_user_type` ON `transactions`;
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- transfers: keep composite (user_id, transfer_date) which covers FK, plus 4 FK indexes
ALTER TABLE `transfers` DROP FOREIGN KEY `fk_transfers_user`;
DROP INDEX `idx_transfers_user_id` ON `transfers`;
ALTER TABLE `transfers` ADD CONSTRAINT `fk_transfers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;