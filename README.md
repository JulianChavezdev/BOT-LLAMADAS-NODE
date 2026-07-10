# Bot Llamadas SaaS

Base SaaS para asistentes telefonicos de restaurantes con Twilio y Deepgram.

La demo actual usa el restaurante ficticio **Bistro Nube** y un menu pequeno para poder mostrar el sistema sin tocar datos reales.

## Desarrollo Local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

El archivo `.env` real no se versiona. Debe contener:

- `PORT`
- `DATABASE_URL`
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `GOOGLE_SHEET_ID` si se mantiene integracion con Sheets

## Scripts

```powershell
npm run check
npm run dev
npm run db:generate
npm run db:bootstrap
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Endpoints

- `GET /health`: estado basico del servicio.
- `POST /twilio-voice`: webhook de voz de Twilio.
- `WS /media-stream`: puente de audio Twilio <-> Deepgram.
- `GET /cocina`: panel demo de cocina.
- `GET /admin`: panel demo de administracion.
- `GET /api/business`: configuracion publica del negocio demo.
- `GET /api/menu-items`: productos normalizados del menu con disponibilidad.
- `PATCH /api/menu-items/:id/availability`: activa o desactiva un producto.
- `GET /api/pedidos`: pedidos pendientes.
- `GET /api/pedidos/todos`: historial de pedidos.
- `GET /api/llamadas`: historial de llamadas.
- `POST /cocina/completar`: marca un pedido como completado.

## Persistencia

El sistema intenta usar Prisma si `DATABASE_URL` esta configurado. Si Prisma no esta disponible, cae automaticamente a JSON local en `data/`.

Esto permite mantener la demo funcionando mientras se completa la migracion a base de datos real.

Para desarrollo local en Windows/Node actual, usa:

```powershell
npm run db:bootstrap
```

Este comando crea la base SQLite local y carga los datos demo de Bistro Nube. `prisma migrate dev` queda disponible para entornos donde el schema engine funcione correctamente.

## Estado SaaS

Hecho:

- Repo limpio e independiente.
- Configuracion de negocio separada.
- Menu separado del motor.
- Prompt generado dinamicamente.
- Restaurante ficticio demo-ready.
- Repositorio de pedidos con fallback JSON.
- Modelo Prisma para `Business`, `MenuItem`, `Customer`, `Call` y `Order`.
- Registro de llamadas y clientes desde el flujo Twilio.
- APIs operativas para pedidos y llamadas.
- Panel admin demo para revisar negocio, menu, pedidos y llamadas.
- Gestion basica de disponibilidad de productos.

Siguiente paso recomendado:

- Hacer que el agente de voz use solo productos disponibles desde la base de datos.
