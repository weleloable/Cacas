# Gotita

Contador de eventos (cacas, pises, cervezas...) para viajes con amigos.

Web: https://weleloable.github.io/Gotita/ — instalable como PWA desde el
móvil o el navegador.

Expo SDK 57 + React Native + expo-router, TypeScript. Detalles del proyecto,
decisiones y cómo está montado: [CLAUDE.md](./CLAUDE.md).

## Desarrollo

```bash
npm install
cp .env.example .env   # y rellena las credenciales de Supabase
npx expo start --web --host lan --port 8082
```

## Tests

```bash
npm test
npx tsc --noEmit
```
