-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('expense', 'payment', 'settlement', 'invitation', 'friend', 'budget', 'savings', 'recurring', 'system') NOT NULL;

-- CreateTable
CREATE TABLE `friend_requests` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `sender_id` VARCHAR(36) NOT NULL,
    `receiver_id` VARCHAR(36) NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `message` TEXT NULL,
    `responded_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `idx_friend_requests_receiver_status`(`receiver_id`, `status`),
    INDEX `idx_friend_requests_sender_id`(`sender_id`),
    UNIQUE INDEX `uk_friend_requests_pair`(`sender_id`, `receiver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `friendships` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_a_id` VARCHAR(36) NOT NULL,
    `user_b_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_friendships_user_b_id`(`user_b_id`),
    UNIQUE INDEX `uk_friendships_pair`(`user_a_id`, `user_b_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `friend_requests` ADD CONSTRAINT `fk_friend_requests_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `friend_requests` ADD CONSTRAINT `fk_friend_requests_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `friendships` ADD CONSTRAINT `fk_friendships_user_a` FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `friendships` ADD CONSTRAINT `fk_friendships_user_b` FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;