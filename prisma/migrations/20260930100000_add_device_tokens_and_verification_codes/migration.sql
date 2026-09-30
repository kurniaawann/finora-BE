-- Token perangkat untuk push notification (FCM) dan kode OTP email
-- (verifikasi email & reset password).

-- CreateTable
CREATE TABLE `device_tokens` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `platform` ENUM('android', 'ios', 'web') NOT NULL,
    `last_used_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_device_tokens_token`(`token`),
    INDEX `idx_device_tokens_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `verification_codes` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `purpose` ENUM('email_verification', 'password_reset') NOT NULL,
    `code_hash` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expires_at` DATETIME(0) NOT NULL,
    `used_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_verification_codes_user_purpose`(`user_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `device_tokens` ADD CONSTRAINT `fk_device_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `verification_codes` ADD CONSTRAINT `fk_verification_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

