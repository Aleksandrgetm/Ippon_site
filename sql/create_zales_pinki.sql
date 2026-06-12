CREATE TABLE IF NOT EXISTS `zales_pinki` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nosaukums` varchar(255) NOT NULL,
  `saturs` longtext,
  `attels` varchar(1024) DEFAULT NULL,
  `galerija` longtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `zales_pinki` (`nosaukums`, `saturs`)
SELECT
  'Sporta zāle Rīga (Piņķi)',
  '<p>Jaunā iela 12, VIA JURMALA OUTLET VILLAGE teritorijā</p><p>+371 26800478 Eduards Sujetovs</p>'
WHERE NOT EXISTS (
  SELECT 1
  FROM `zales_pinki`
  WHERE `nosaukums` = 'Sporta zāle Rīga (Piņķi)'
);
