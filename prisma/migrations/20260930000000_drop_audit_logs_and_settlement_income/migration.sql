-- Audit log tidak dipakai: aplikasi mobile tidak membutuhkan riwayat perubahan per baris.
ALTER TABLE `audit_logs` DROP FOREIGN KEY `fk_audit_logs_user`;
DROP TABLE `audit_logs`;

-- Satu pelunasan kini dicatat di dua sisi: transaksi keluar milik pembayar
-- dan transaksi masuk milik penerima, sehingga settlement_id tidak lagi unik.
ALTER TABLE `transactions` DROP FOREIGN KEY `fk_transactions_settlement`;
DROP INDEX `settlement_id` ON `transactions`;
CREATE INDEX `idx_transactions_settlement_id` ON `transactions`(`settlement_id`);
ALTER TABLE `transactions` ADD CONSTRAINT `fk_transactions_settlement` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
