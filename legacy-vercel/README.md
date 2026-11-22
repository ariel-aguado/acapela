# Página de mudanza para los .vercel.app

Se publica en los proyectos de Vercel `acappella`, `acappella-nogales` y
`acappella-lavilla` (direcciones `acappella-*.vercel.app`). No forma parte de
la app: no se compila ni se despliega en la VPS.

- `index.html`: lee los datos de la app vieja (himnario, favoritos, último
  himno, tamaño de letra, búsquedas), desinstala el service worker, borra la
  caché y redirige a `https://acapela.app/#import=<base64url JSON>`.
- `sw.js`: reemplaza al service worker viejo para que la PWA instalada se
  actualice, se desinstale y cargue la página de mudanza.
- Todas las rutas sirven `index.html`, salvo `/sw.js`.

La app nueva importa esos datos en `app/plugins/00.legacy-import.client.ts`.
