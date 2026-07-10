# Bot Llamadas SaaS

Base SaaS para asistentes telefonicos de restaurantes.

## Estado

Este repo nace desde el prototipo `bot-llamadas-node`, pero limpio e independiente:

- Sin `node_modules`
- Sin `.env`
- Sin `credentials.json`
- Con `.env.example`
- Con `.gitignore`
- Con Git propio

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm run dev
```

## Siguiente objetivo

Convertir el prototipo de un restaurante en una base multi-negocio:

- Configuracion por negocio
- Menu fuera de `index.js`
- Prompt generado dinamicamente
- Persistencia de pedidos
- Panel interno de operaciones
