-- AlterTable
ALTER TABLE `savings_contributions` ADD COLUMN `contributor_id` VARCHAR(36) NULL,
    ADD COLUMN `proof_url` TEXT NULL,
    ADD COLUMN `status` ENUM('pending', 'submitted', 'confirmed', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `savings_goals` ADD COLUMN `share_token` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `idx_savings_contributions_contributor_id` ON `savings_contributions`(`contributor_id`);

-- CreateIndex
CREATE INDEX `idx_savings_contributions_status` ON `savings_contributions`(`status`);

-- CreateIndex
CREATE UNIQUE INDEX `uk_savings_goals_share_token` ON `savings_goals`(`share_token`);

-- AddForeignKey
ALTER TABLE `savings_contributions` ADD CONSTRAINT `fk_savings_contributions_contributor` FOREIGN KEY (`contributor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;