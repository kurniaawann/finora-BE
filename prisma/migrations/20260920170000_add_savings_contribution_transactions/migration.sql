-- AlterTable
ALTER TABLE `savings_contributions` ADD COLUMN `payment_method_id` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `savings_contribution_id` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `fk_savings_contributions_pm` ON `savings_contributions`(`payment_method_id`);

-- CreateIndex
CREATE UNIQUE INDEX `savings_contribution_id` ON `transactions`(`savings_contribution_id`);

-- AddForeignKey
ALTER TABLE `savings_contributions` ADD CONSTRAINT `fk_savings_contributions_pm` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_sav_contribution` FOREIGN KEY (`savings_contribution_id`) REFERENCES `savings_contributions`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;