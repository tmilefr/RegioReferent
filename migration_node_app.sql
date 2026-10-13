-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : colonnes nécessaires à l'application Node.js de validation
-- ═══════════════════════════════════════════════════════════════════════════
-- À exécuter UNE SEULE FOIS sur la base de production.
-- Toutes les instructions sont idempotentes (IF NOT EXISTS / IGNORE).
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Commentaire global de session (référent → bureau)
ALTER TABLE `travaux`
  ADD COLUMN IF NOT EXISTS `commentaire_ref` TEXT NULL
  COMMENT 'Commentaire global laissé par le référent lors de la validation';

-- 2. Traçabilité de la validation référent dans infos
ALTER TABLE `infos`
  ADD COLUMN IF NOT EXISTS `validated_by_ref`    INT(11)  NULL DEFAULT NULL
  COMMENT 'famille.id du référent ayant validé cette présence',
  ADD COLUMN IF NOT EXISTS `validated_by_ref_at` DATETIME NULL DEFAULT NULL
  COMMENT 'Horodatage de la validation par le référent';

-- 3. Commentaire individuel référent sur une inscription
--    (si la colonne n'existe pas encore)
ALTER TABLE `infos`
  ADD COLUMN IF NOT EXISTS `commentaire_ref` TEXT NULL
  COMMENT 'Commentaire laissé par le référent pour cet inscrit';

-- 4. Table des tokens (idempotente : ne recrée pas si elle existe)
CREATE TABLE IF NOT EXISTS `validation_tokens` (
  `id`          INT(11)      NOT NULL AUTO_INCREMENT,
  `id_travaux`  INT(11)      NOT NULL,
  `id_fam_ref`  INT(11)      NOT NULL,
  `token`       VARCHAR(64)  NOT NULL,
  `expires_at`  DATETIME     NOT NULL,
  `used_at`     DATETIME     NULL DEFAULT NULL,
  `created`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token` (`token`),
  KEY `idx_travaux_ref` (`id_travaux`, `id_fam_ref`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Jetons à usage unique envoyés par email au référent travaux';
