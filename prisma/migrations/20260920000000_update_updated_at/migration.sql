-- AlterTable
ALTER TABLE `accounts` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `budgets` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `categories` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `events` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `expense_payments` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `expenses` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `groups` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `payment_methods` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `profiles` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `recurring_transactions` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `savings_goals` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `settlements` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `transactions` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `users` ALTER COLUMN `updated_at` DROP DEFAULT;

