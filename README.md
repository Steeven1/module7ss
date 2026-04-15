# Workspace SPDP — Vite único

- **Raíz del repositorio Git:** carpeta `modelos` en tu máquina (p. ej. `D:\Cursor\modelos`). Remoto: [github.com/jorgeguerron/spdp-calculadoras](https://github.com/jorgeguerron/spdp-calculadoras).
- **Tema visual:** `shared/spdp-theme.css` (tokens y base) lo importan la calculadora de gran escala, la de sanciones y `hub.css` del índice.
- **Desarrollo:** `npm install` en esta carpeta (`modelos/`), luego `npm run dev`. Abre el hub en `/` y enlaza a cada app.
- **Producción:** `npm run build` → salida en `dist/` con `index.html` del hub y una carpeta por calculadora.
- **Apps:** `calculadora-tratamiento-gran-escala/`, `calculadora-sanciones-spdp/`. Cada una conserva su `index.html` y código; `vite.config.js` aquí declara entradas multi-página.
- **Desde una subcarpeta:** `vite.config.js` reexporta `../vite.config.js` para poder usar el mismo `npm run dev` localmente.
