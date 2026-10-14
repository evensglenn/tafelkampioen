# Richtlijnen voor Claude

## Versie ophogen bij elke wijziging

Hoog bij elke wijziging aan de app de getoonde versie op (patch-versie, bv. 1.13.5 → 1.13.6), in dezelfde branch als de wijziging:

```sh
npm version patch --no-git-tag-version
node scripts/sync-version.mjs
```

Dit werkt `package.json`, `package-lock.json` en `public/version.json` bij. De versie wordt onderaan in de app getoond (`v{APP_VERSION}`) en gebruikt om nieuwe releases te detecteren.
