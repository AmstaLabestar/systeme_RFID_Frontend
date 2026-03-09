# RFID Presence - Mini guide de test fonctionnel

Ce guide permet de verifier le flux complet:

`boitier / publisher MQTT -> backend ingestion -> dispatcher -> historique + realtime -> dashboard`

## 1. Objectif

Valider qu'un scan RFID presence remonte bien:

- dans l'ingestion backend
- dans l'historique metier
- dans le stream temps reel
- dans le dashboard client

## 2. Prerequis

Avant le test, il faut deja avoir:

- PostgreSQL accessible
- backend configure et demarrable
- frontend demarrable
- broker MQTT accessible
- un `deviceId` existant dans le SaaS
- un systeme lie a ce boitier
- un employe
- un badge / identifiant RFID

Si tu veux voir un scan `attribue`, le badge doit deja etre assigne a cet employe sur ce boitier.

Sinon, le scan sera accepte mais affichera un statut `non attribue`.

## 3. Variables backend a verifier

Dans `backend/.env`:

```env
DEVICE_MQTT_ENABLED=true
DEVICE_MQTT_BROKER_URL=mqtt://localhost:1883
DEVICE_MQTT_TOPICS=devices/+/events
DEVICE_MQTT_QOS=1
DEVICE_MQTT_CLIENT_ID=rfid-backend-ingestion-local
DEVICE_EVENT_DISPATCH_INTERVAL_MS=3000
DEVICE_EVENT_DISPATCH_BATCH_SIZE=50
```

Si le broker demande une authentification:

```env
DEVICE_MQTT_USERNAME=your-broker-username
DEVICE_MQTT_PASSWORD=your-broker-password
```

## 4. Demarrage local

Dans un premier terminal:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
npm run dev:backend
```

Dans un second terminal:

```bash
npm run dev
```

## 5. Ouvrir le dashboard

Connecte-toi avec un compte ayant acces au tenant concerne, puis ouvre:

- `Overview`
- `RFID Presence`
- `Historique`

Si le dashboard est deja ouvert, le stream SSE permettra de voir la remontee quasi en temps reel.

Si le dashboard est ferme, le resultat restera visible apres rafraichissement via snapshot / historique.

## 6. Generer la cle d'ingestion du boitier

Le boitier ou le publisher de test doit utiliser une cle d'ingestion valide.

Endpoint:

```text
POST /device-ingestion/keys/:deviceId/rotate
```

Cette requete doit etre faite avec une session dashboard authentifiee.

Conserve la cle retournee, par exemple:

```text
dik_xxx
```

## 7. Test rapide sans firmware reel

Le repo contient un publisher de test MQTT:

```bash
npm --prefix backend run mqtt:test:publish -- --deviceId=<device-uuid> --ingestionKey=<dik_xxx> --badgeCode=BADGE-001
```

Exemple:

```bash
npm --prefix backend run mqtt:test:publish -- --deviceId=7a1f2c3d-1111-2222-3333-444455556666 --ingestionKey=dik_xxx --badgeCode=BADGE-001
```

Options utiles:

```bash
npm --prefix backend run mqtt:test:publish -- --help
```

## 8. Test avec le vrai boitier

Le boitier doit publier un message MQTT compatible sur un topic du type:

```text
devices/<deviceId>/events
```

Payload recommande:

```json
{
  "ingestionKey": "dik_xxx",
  "event": {
    "schemaVersion": "1.0",
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "eventType": "badge.scanned",
    "occurredAt": "2026-03-09T12:00:00Z",
    "source": {
      "deviceId": "device-uuid",
      "systemCode": "RFID_PRESENCE",
      "deviceMac": "AA:BB:CC:DD:EE:FF",
      "firmwareVersion": "1.0.0",
      "sequence": 1
    },
    "payload": {
      "badgeCode": "BADGE-001"
    }
  }
}
```

## 9. Ce que tu dois observer

### Cote backend

Dans les logs:

- connexion au broker MQTT
- souscription active aux topics
- pas d'erreur de validation ou de rejet

### Cote dashboard

Dans `RFID Presence`:

- le dernier scan apparait
- les compteurs sont mis a jour

Dans `Historique`:

- un evenement `identifier_scanned` apparait
- le statut visuel montre `Attribue` ou `Non attribue`
- le panneau debug peut afficher les IDs techniques

Dans `Overview`:

- les donnees presence et la derniere mise a jour evoluent

## 10. Interpretation du resultat

### Cas 1 - tout fonctionne

Le scan apparait dans le dashboard et dans l'historique.

Conclusion:

- broker OK
- ingestion OK
- dispatcher OK
- flux temps reel OK
- integration front OK

### Cas 2 - scan visible mais `non attribue`

Conclusion:

- le pipeline technique fonctionne
- le lien metier badge -> employe -> boitier n'est pas encore coherent

### Cas 3 - rien dans le dashboard mais pas d'erreur broker

Verifier:

- `DEVICE_MQTT_ENABLED=true`
- le backend est bien relance apres changement de `.env`
- le topic publie correspond a `DEVICE_MQTT_TOPICS`
- `deviceId` existe bien dans le SaaS
- la cle `ingestionKey` est valide
- `systemCode=RFID_PRESENCE`
- `eventType=badge.scanned`
- le `payload.badgeCode` est bien renseigne

### Cas 4 - evenement accepte mais pas de mise a jour instantanee

Verifier:

- la page dashboard est ouverte
- la session utilisateur est valide
- le stream SSE n'est pas bloque par le navigateur, proxy ou CORS

Dans ce cas, fais aussi un rafraichissement manuel pour verifier le snapshot.

## 11. Ce que ce test valide vraiment

Si ce test passe, tu as valide le socle du systeme:

- un boitier peut emettre un evenement standardise
- le backend peut l'absorber sans API specifique par systeme
- le domaine `RFID_PRESENCE` reagit correctement
- le dashboard client recoit la donnee exploitable

Ce test ne valide pas encore:

- les autres systemes materiels
- les retry firmware
- les coupures reseau longues
- les politiques avancees de replay / reconciliation

## 12. Suite logique apres ce test

Une fois ce test OK, l'etape suivante saine est:

1. fiabiliser les scenarios d'erreur du boitier
2. valider plusieurs scans successifs avec `sequence`
3. tester les badges non attribues puis attribues
4. brancher ensuite le vrai firmware dans le meme contrat d'evenement
