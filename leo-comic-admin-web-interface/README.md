# Leo Comic Admin

Panel de administración para el proyecto de cómic de Leo: lista de historias (con su prompt de
imagen e imagen final) y una sección de personajes para mantener la consistencia visual entre
historias. Incluye una pantalla para generar el borrador de una historia hablando con Gemini en
vivo. Un único admin, pensado para usarse desde cualquier lugar vía Firebase Hosting.

Ver `docs/spec.md` (qué construir) y `docs/plan.md` (cómo, con el detalle de cada pantalla y de
la integración con Gemini).

## Stack
- Vue 3 + Vite (SPA).
- Firebase: Firestore (datos), Storage (imágenes), Authentication (email/password, un solo
  admin), Hosting (despliegue), Cloud Functions (puente seguro con la API de Gemini).
- Gemini Live API para la generación de historias por voz.

## Requisitos
- Node.js 20+.
- Un proyecto de Firebase propio para esta app (Firestore, Storage, Authentication y Hosting
  activados), con un usuario admin creado a mano en la consola (no hay alta de usuarios en la
  UI).
- Una API key de Gemini (para las Cloud Functions; nunca llega al navegador).
- CLI de Firebase (`npm install -g firebase-tools`) para desplegar.

## Configuración
1. Copia `.env.example` a `.env` y rellena los valores de `Project settings > General > Your
   apps > SDK setup and config` de tu proyecto de Firebase.
2. Edita `.firebaserc` y pon el ID real de tu proyecto de Firebase en vez de
   `REPLACE_WITH_FIREBASE_PROJECT_ID`.
3. Crea el usuario admin a mano en Firebase Console → Authentication → Users.
4. Configura el secreto de Gemini para las Cloud Functions (una sola vez):
   ```
   firebase functions:secrets:set GEMINI_API_KEY
   ```

## Desarrollo
```
npm install
npm run dev
```

Para probar las Cloud Functions en local hace falta el emulador de Firebase Functions:
```
cd functions && npm install
firebase emulators:start --only functions
```

## Despliegue
Manual, sin CI/CD por ahora:
```
npm run build
firebase deploy
```

Esto despliega Hosting (la SPA compilada en `dist/`), las reglas de Firestore/Storage y las
Cloud Functions.

## Estructura
- `src/views/` — las 6 pantallas: login, lista/detalle de historias, lista/detalle de
  personajes, generar historia por voz.
- `src/stories.js`, `src/characters.js` — acceso a Firestore/Storage para cada colección.
- `src/gemini.js`, `src/audio.js`, `public/pcm-capture-worklet.js` — sesión de voz con Gemini
  Live (captura de micrófono, reproducción de audio, transcript).
- `functions/index.js` — dos Cloud Functions: `createGeminiLiveToken` (emite un token efímero
  para que el navegador abra la sesión de voz directo con Gemini, sin exponer la clave real) y
  `draftStoryFromTranscript` (convierte el transcript de la conversación en un borrador de
  título + descripción).
- `firestore.rules`, `storage.rules` — solo lectura/escritura con usuario autenticado.

## Estado
Pantallas 1-3 (login, historias, personajes) son CRUD estándar sobre Firestore/Storage, sin
partes inciertas. La pantalla 4 (generar historia por voz) tiene implementación completa pero
no se ha podido validar contra credenciales reales de Firebase/Gemini en este entorno — revisa
`docs/plan.md` para el detalle de qué falta confirmar al desplegar (nombre del modelo Live
vigente, comportamiento real del WebSocket desde el navegador).
