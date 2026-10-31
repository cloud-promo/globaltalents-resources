# API marchand e-Wari : contrat d'intégration (v1)

Ce contrat décrit ce que l'API e-Wari doit exposer pour qu'un site marchand comme Global Talents Resources encaisse un paiement. Côté Global Talents, tout est déjà codé et testé contre un simulateur (`scripts/mock-ewari.mjs`). Le seul fichier qui dépend du format exact est `src/lib/ewari.ts` : si l'API réelle diffère, on l'adapte là.

## Principe

1. Le site marchand crée un paiement chez e-Wari (serveur à serveur).
2. e-Wari renvoie un QR code et un lien. Le client paie dans l'application e-Wari (solde, Mobile Money, carte) et valide avec son code.
3. e-Wari prévient le site marchand par un webhook signé.
4. Le site marchand relit le paiement auprès de l'API avant de livrer. Il ne fait jamais confiance au seul webhook.

## Authentification

- URL de base : `https://api.ewari.net/merchant/v1` (production) et `https://sandbox.api.ewari.net/merchant/v1` ou équivalent (bac à sable).
- En-tête `Authorization: Bearer <clé secrète>`. Clés distinctes `sk_test_…` (bac à sable) et `sk_live_…` (production), propres à chaque marchand, révocables depuis l'espace partenaires.
- En-tête `Idempotency-Key` sur `POST /payments` : un même identifiant renvoie le même paiement pendant 24 h, sans en créer un second.
- HTTPS obligatoire, TLS 1.2 minimum. Réponses en JSON UTF-8.

## Objet Paiement

| Champ | Type | Description |
| --- | --- | --- |
| `id` | texte | Identifiant e-Wari, par exemple `pay_8f2c…` |
| `status` | texte | `pending`, `succeeded`, `failed`, `cancelled`, `expired` |
| `amount` | entier | Montant en unités entières de la devise (FCFA, GNF), sans décimales |
| `currency` | texte | `XOF` ou `GNF` |
| `reference` | texte | Référence du marchand, unique par marchand |
| `merchant_code` | texte | Code marchand e-Wari, déjà utilisé par les QR `p=` |
| `pay_url` | texte | Page web e-Wari de paiement (`https://app.ewari.net/app#p=CODE&a=MONTANT&r=ID`) |
| `qr_payload` | texte | Contenu du QR à afficher (`ewari://pay?p=CODE&a=MONTANT&r=ID`) |
| `deeplink` | texte | Lien qui ouvre l'application e-Wari sur ce paiement |
| `expires_at` | date ISO | Au-delà, le paiement passe en `expired` |
| `paid_at` | date ISO ou null | Date d'encaissement |
| `fee` | entier ou null | Commission e-Wari prélevée |
| `payer` | objet ou null | `{ method, phone }`, numéro masqué |
| `failure_reason` | texte ou null | Motif lisible en cas d'échec |
| `metadata` | objet | Renvoyé tel quel (20 clés maximum) |

## Points d'accès

### `POST /payments`
Corps : `amount`, `currency`, `reference`, `description`, `customer` (`name`, `email`, `phone`, tous facultatifs), `callback_url`, `return_url`, `expires_in` (secondes, 1800 par défaut), `metadata`.
Réponse `201` : l'objet Paiement en `pending`. Si `customer.phone` correspond à un compte e-Wari, l'application peut lui pousser la demande directement, comme les demandes de paiement PI-SPI existantes.

### `GET /payments/{id}`
Réponse `200` : l'objet Paiement à jour. Le marchand l'appelle à la réception d'un webhook et pendant que la page de paiement est ouverte.

### `POST /payments/{id}/cancel`
Annule un paiement encore `pending`. S'il a été payé entre-temps, renvoie l'objet en `succeeded` sans l'annuler.

### `POST /refunds` (lot suivant)
Corps : `payment_id`, `amount` (total ou partiel), `reason`. Webhook `refund.succeeded`.

### `POST /payments/{id}/simulate` (bac à sable uniquement)
Corps : `{ "outcome": "succeeded" | "failed" | "expired" }`. Fait passer le paiement dans l'état demandé et envoie le webhook. Indispensable pour la recette.

## Webhooks

- `POST` vers `callback_url`, corps `{ "id": "evt_…", "type": "payment.succeeded", "created": "…", "data": <objet Paiement> }`.
- Types : `payment.succeeded`, `payment.failed`, `payment.cancelled`, `payment.expired`, puis `refund.succeeded`.
- Signature : en-tête `X-Ewari-Signature: t=<horodatage Unix>,v1=<hex>` avec `v1 = HMAC-SHA256(secret_webhook, "<t>.<corps brut>")`. Un secret `whsec_…` par marchand et par environnement.
- Le marchand refuse une signature invalide ou âgée de plus de 5 minutes.
- Nouvelles tentatives si la réponse n'est pas `2xx` : après 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, 24 h. Même `id` d'événement à chaque tentative.
- Le marchand doit pouvoir recevoir deux fois le même événement sans effet en double.

## Erreurs

Format : `{ "error": { "code": "invalid_amount", "message": "…" } }`.
Codes HTTP : `400` JSON invalide, `401` clé invalide, `404` introuvable, `409` paiement déjà finalisé, `422` champ invalide, `429` trop de requêtes, `5xx` erreur e-Wari (le marchand relance).

## Comptes marchands (espace partenaires e-Wari)

- Création du marchand Global Talents Resources (KYB : RCCM, NINEA, représentant légal), avec son `merchant_code`.
- Compte de règlement : wallet marchand e-Wari, avec reversement vers le compte bancaire de la société.
- Génération et rotation des clés API et du secret webhook, en bac à sable et en production.
- Déclaration des URL de webhook autorisées.
- Relevé des transactions et des commissions, exportable, pour le rapprochement comptable.

## Configuration côté Global Talents

| Variable | Valeur |
| --- | --- |
| `PAYMENTS_MODE` | `ewari` (sinon : mode démonstration) |
| `EWARI_API_URL` | URL de base de l'API marchand |
| `EWARI_SECRET_KEY` | `sk_test_…` puis `sk_live_…` |
| `EWARI_WEBHOOK_SECRET` | `whsec_…` |

URL de webhook à déclarer chez e-Wari : `https://globaltalents-resources.com/api/webhooks/ewari`.

## Recette

`tests/ewari.py` couvre 9 cas : création et QR, paiement réussi avec webhook rejoué, webhook perdu rattrapé par la page, signature invalide ou trop ancienne, webhook signé mais non confirmé par l'API, montant payé différent du montant demandé, paiement refusé, annulation, traces dans le journal d'audit. Les mêmes cas sont à rejouer contre le bac à sable e-Wari réel.
