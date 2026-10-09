-- Foto struk/nota untuk transaksi pribadi dan foto bukti untuk transfer antar rekening.
ALTER TABLE `transactions` ADD COLUMN `receipt_url` TEXT NULL;
ALTER TABLE `transfers` ADD COLUMN `proof_url` TEXT NULL;
