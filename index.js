import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// REGLA DE ORO: Configuración absoluta del entorno como primera línea activa
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import http from 'http';
import twilio from 'twilio';
import { google } from 'googleapis';
import { defaultBusiness } from './src/config/businesses.js';
import { buildSystemPrompt } from './src/services/promptBuilder.js';
import { bistroNubeMenu } from './src/config/menus/bistroNubeMenu.js';
import { agentFunctions } from './src/agent/functions.js';
import {
    completeOrder,
    createOrder,
    findPendingOrderByPhone,
    listOrders,
    listPendingOrders,
    updateOrder
} from './src/repositories/orderRepository.js';
import { finishCall, listCalls, startCall } from './src/repositories/callRepository.js';
import {
    createMenuItem,
    deleteMenuItem,
    listMenuItems,
    setMenuItemAvailability,
    updateMenuItem
} from './src/repositories/menuRepository.js';
import { getBusinessById } from './src/repositories/businessRepository.js';
import { describeAdminAuth, requireAdmin } from './src/middleware/adminAuth.js';
import { resolveTenant } from './src/middleware/tenantResolver.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 5050;
const business = defaultBusiness;
const adminAuthStatus = describeAdminAuth();

console.log("==========================================");
console.log("🔑 AUDITORÍA DE CREDENCIALES:");
console.log("Deepgram Key:", process.env.DEEPGRAM_API_KEY ? "✅ configurada" : "❌ NO DETECTADA");
console.log("OpenAI Key:", process.env.OPENAI_API_KEY ? "✅ configurada" : "❌ NO DETECTADA");
console.log("GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? "✅ configurada" : "❌ NO DETECTADA");
console.log("TWILIO_WHATSAPP_FROM:", process.env.TWILIO_WHATSAPP_FROM ? `✅ (${process.env.TWILIO_WHATSAPP_FROM})` : "❌ NO DETECTADA");
console.log("==========================================");

if (adminAuthStatus.usingDefaultCredentials) {
    console.warn(`Admin Auth en modo demo: ${adminAuthStatus.username} / ${process.env.ADMIN_PASSWORD || 'bistro-demo'}`);
} else {
    console.log(`Admin Auth configurada para usuario: ${adminAuthStatus.username}`);
}

// Clientes API
const clientTwilio = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Google Sheets
const authSheets = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth: authSheets });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    if (req.path === '/admin.html' || req.path === '/cocina.html') {
        return requireAdmin(req, res, next);
    }

    next();
});
app.use(express.static(path.join(__dirname, 'public')));

const menu = bistroNubeMenu;

async function buildCurrentSystemPrompt(currentBusiness) {
    const menuItems = await listMenuItems(currentBusiness.id);
    return buildSystemPrompt({ business: currentBusiness, menuItems });
}

app.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'bot-llamadas-saas',
        businessId: business.id
    });
});

// ==========================================
// RUTAS HTTP Y FUNCIONES DE NEGOCIO SE MANTIENEN IGUALES
// ==========================================
app.get('/cocina', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'cocina.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.post('/twilio-voice', resolveTenant, (req, res) => {
    const currentBusiness = req.business;
    const numeroLlamante = req.body.From || 'Desconocido';
    res.type('text/xml');
    res.send(`
        <Response>
            <Say language="${currentBusiness.voice.twilioLanguage}" voice="${currentBusiness.voice.twilioVoice}">Conectando con el asistente de ${currentBusiness.name}.</Say>
            <Connect>
                <Stream url="wss://${req.headers.host}/media-stream">
                    <Parameter name="From" value="${numeroLlamante}" />
                    <Parameter name="BusinessId" value="${currentBusiness.id}" />
                </Stream>
            </Connect>
        </Response>
    `);
});

app.use(['/api', '/cocina/completar'], requireAdmin);
app.use(['/api', '/cocina/completar'], resolveTenant);

app.get('/api/pedidos', async (req, res) => {
    const orders = await listPendingOrders(req.business.id);
    res.json(orders.map(order => ({
        id: order.id,
        nombre: order.customerName,
        telefono: order.phone,
        resumen: order.summary,
        total: order.total,
        estado: order.status
    })));
});

app.get('/api/business', (req, res) => {
    const currentBusiness = req.business;
    res.json({
        id: currentBusiness.id,
        name: currentBusiness.name,
        city: currentBusiness.city,
        country: currentBusiness.country,
        locale: currentBusiness.locale,
        timezone: currentBusiness.timezone,
        serviceMode: currentBusiness.serviceMode,
        voice: {
            greeting: currentBusiness.voice.greeting,
            twilioLanguage: currentBusiness.voice.twilioLanguage,
            twilioVoice: currentBusiness.voice.twilioVoice,
            deepgramSpeakModel: currentBusiness.voice.deepgramSpeakModel,
            deepgramListenModel: currentBusiness.voice.deepgramListenModel,
            deepgramLanguage: currentBusiness.voice.deepgramLanguage
        }
    });
});

app.get('/api/menu', (req, res) => {
    res.json(menu);
});

app.get('/api/menu-items', async (req, res) => {
    const items = await listMenuItems(req.business.id);
    res.json(items);
});

app.post('/api/menu-items', async (req, res) => {
    const { category, name, description = '', price, available = true } = req.body;
    const numericPrice = Number(price);

    if (!category || !name || !Number.isFinite(numericPrice) || numericPrice < 0) {
        return res.status(400).json({ error: 'category, name y price valido son requeridos' });
    }

    const item = await createMenuItem({
        businessId: req.business.id,
        category: String(category).trim(),
        name: String(name).trim(),
        description: String(description || '').trim(),
        price: numericPrice,
        available: available !== false
    });

    res.status(201).json(item);
});

app.patch('/api/menu-items/:id/availability', async (req, res) => {
    const { available } = req.body;

    if (typeof available !== 'boolean') {
        return res.status(400).json({ error: 'available debe ser boolean' });
    }

    const item = await setMenuItemAvailability({
        businessId: req.business.id,
        id: req.params.id,
        available
    });

    if (!item) {
        return res.status(404).json({ error: 'producto no encontrado' });
    }

    res.json({ ok: true, item });
});

app.patch('/api/menu-items/:id', async (req, res) => {
    const { category, name, description, price } = req.body;
    const data = {
        category: category === undefined ? undefined : String(category).trim(),
        name: name === undefined ? undefined : String(name).trim(),
        description: description === undefined ? undefined : String(description || '').trim(),
        price: price === undefined ? undefined : Number(price)
    };

    if (data.category === '' || data.name === '' || (data.price !== undefined && (!Number.isFinite(data.price) || data.price < 0))) {
        return res.status(400).json({ error: 'datos de producto invalidos' });
    }

    const item = await updateMenuItem({
        businessId: req.business.id,
        id: req.params.id,
        ...data
    });

    if (!item) {
        return res.status(404).json({ error: 'producto no encontrado' });
    }

    res.json({ ok: true, item });
});

app.delete('/api/menu-items/:id', async (req, res) => {
    const deleted = await deleteMenuItem({
        businessId: req.business.id,
        id: req.params.id
    });

    if (!deleted) {
        return res.status(404).json({ error: 'producto no encontrado' });
    }

    res.status(204).send();
});

app.get('/api/pedidos/todos', async (req, res) => {
    const orders = await listOrders(req.business.id);
    res.json(orders);
});

app.get('/api/llamadas', async (req, res) => {
    const calls = await listCalls(req.business.id);
    res.json(calls);
});

app.post('/cocina/completar', async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'id requerido' });
    }

    const order = await completeOrder(id, req.business.id);

    if (!order) {
        return res.status(404).json({ error: 'pedido no encontrado' });
    }

    res.json({ ok: true, order });
});

async function enviarMensajePedidoListo(telefono, nombre) { /* Tu lógica existente */ }
async function obtenerNombrePrimeraHoja(sheetsClient, sheetId) { /* Tu lógica existente */ }
async function buscarPedidoPendientePorTelefono(telefono, businessId) {
    return findPendingOrderByPhone(telefono, businessId);
}
async function guardarPedido(streamSid, cliente, comandaText, telefono, total, currentBusiness) {
    return createOrder({
        id: streamSid,
        businessId: currentBusiness.id,
        callId: streamSid,
        customerName: cliente,
        phone: telefono,
        summary: comandaText,
        total
    });
}
async function actualizarComandaExistente(orderId, cliente, nuevoResumen, total, businessId) {
    return updateOrder(orderId, {
        customerName: cliente,
        summary: nuevoResumen,
        total
    }, businessId);
}

// ==========================================
// WEBSOCKET PRINCIPAL: TWILIO ↔ VOICE AGENT
// ==========================================
wss.on('connection', (twilioWs, req) => {
    if (!req.url.includes('/media-stream')) {
        twilioWs.close();
        return;
    }

    console.log('📞 Twilio abrió canal de audio WebSocket.');

    let streamSid = null;
    let clienteTelefono = null;
    let pedidoPrevio = null;
    let conversacionFinalizada = false;
    let agentWs = null;
    let agentReady = false; // <-- CRÍTICO: El cerrojo lógico de conexión
    let callClosed = false;
    let activeBusiness = business;

    async function cerrarRegistroLlamada(status = 'completed') {
        if (!streamSid || callClosed) return;
        callClosed = true;
        await finishCall(streamSid, status);
    }
function conectarVoiceAgent() {
        console.log('🤖 Conectando con Deepgram Voice Agent...');

        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            console.error("❌ DEEPGRAM_API_KEY no configurada en el entorno.");
            return;
        }

        // CORRECCIÓN MEDULAR: La autenticación va obligatoriamente en los subprotocols
        agentWs = new WebSocket('wss://agent.deepgram.com/v1/agent/converse', ['token', apiKey]);
        let keepAliveInterval = null;

        agentWs.on('open', () => {
            keepAliveInterval = setInterval(() => {
                if (agentWs && agentWs.readyState === WebSocket.OPEN) {
                    agentWs.send(JSON.stringify({ type: 'KeepAlive' }));
                }
            }, 5000);
            console.log('✅ Conexión TCP establecida con Deepgram. Esperando mensaje de bienvenida (Welcome)...');
        });

        agentWs.on('message', async (data) => {
            let event;
            try {
                event = JSON.parse(data.toString());
            } catch (e) {
                if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
                    twilioWs.send(JSON.stringify({
                        event: "media",
                        streamSid,
                        media: {
                            payload: data.toString("base64")
                        }
                    }));
                }
                return;
            }

            switch (event.type) {
                case 'Welcome':
                    console.log(`👋 Welcome recibido (ID: ${event.request_id}). Enviando configuración plana oficial...`);
                    
                    const systemPrompt = await buildCurrentSystemPrompt(activeBusiness);
                    console.log('Menu disponible cargado para Voice Agent.');

                    // ESQUEMA OFICIAL DE DEEPGRAM PARA VOICE AGENT CON TWILIO
const config = {
    type: "Settings",
    audio: {
        input: {
            encoding: "mulaw",
            sample_rate: 8000
        },
        output: {
            encoding: "mulaw",
            sample_rate: 8000,
            container: "none"
        }
    },
    agent: {
        listen: {
            provider: {
                type: "deepgram",
                model: activeBusiness.voice.deepgramListenModel,
                language: activeBusiness.voice.deepgramLanguage,
                smart_format: false
            }
        },
        think: {
            provider: {
                type: "open_ai",
                model: "gpt-4o-mini"
            },
            prompt: systemPrompt,
            functions: agentFunctions
        },
        speak: {
            provider: {
                type: "deepgram",
                model: activeBusiness.voice.deepgramSpeakModel
            }
        },
        greeting: activeBusiness.voice.greeting
    }
}; 
console.log("ENVIANDO SETTINGS");
console.log(JSON.stringify(config, null, 2));

try {
    agentWs.send(JSON.stringify(config));
    console.log("Settings enviados");
}
catch(e){
    console.error(e);
}


                    break;

                case 'SettingsApplied':
                    console.log('✅ Configuración aceptada por Deepgram. ¡Tubería de audio abierta!');
                    agentReady = true; 
                    break;

                case 'UserStartedSpeaking':
                    if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
                        twilioWs.send(JSON.stringify({ event: 'clear', streamSid: streamSid }));
                    }
                    break;

                case 'ConversationText':
                    console.log(`💬 [${event.role}]: ${event.content}`);
                    break;

                case 'FunctionCallRequest':
                    console.log('⚡ Function call recibida:', JSON.stringify(event, null, 2));
                    await manejarFunctionCall(event);
                    break;

                case 'Error':
                    console.error('❌ Error emitido por la API de Deepgram:', JSON.stringify(event, null, 2));
                    break;
            }
        });

        agentWs.on("close", (code, reason) => {
            agentReady = false;
            if (keepAliveInterval) clearInterval(keepAliveInterval);
            console.log("CLOSE");
            console.log("code:", code);
            console.log("reason:", reason.toString());
        });

        agentWs.on("error", (error) => {
            agentReady = false;
            console.error("Error en WebSocket de Deepgram:", error.message);
        });
    }

    async function manejarFunctionCall(event) {
        if (conversacionFinalizada) return;

        const call = event.functions?.[0] || {
            id: event.function_call_id,
            name: event.function_name,
            arguments: event.input
        };

        const functionName = call.name;
        const functionCallId = call.id;
        let input = {};

        try {
            input = typeof call.arguments === 'string'
                ? JSON.parse(call.arguments || '{}')
                : (call.arguments || {});
        } catch (error) {
            console.error('Argumentos invalidos en FunctionCallRequest:', call.arguments);
            return;
        }

        if (functionName === 'finalizar_pedido') {
            conversacionFinalizada = true;

            const { nombre_cliente, resumen_pedido, total } = input;
            console.log(`🎉 Pedido finalizado:\n Nombre: ${nombre_cliente}\n Resumen: ${resumen_pedido}\n Total: €${total}`);

            try {
                if (pedidoPrevio) {
                    await actualizarComandaExistente(pedidoPrevio.id, nombre_cliente, resumen_pedido, total, activeBusiness.id);
                } else {
                    await guardarPedido(streamSid, nombre_cliente, resumen_pedido, clienteTelefono, total, activeBusiness);
                }
                if (agentWs && agentWs.readyState === WebSocket.OPEN) {
                    agentWs.send(JSON.stringify({
                        type: 'FunctionCallResponse',
                        id: functionCallId,
                        name: functionName,
                        content: `Pedido registrado correctamente para ${nombre_cliente}. Total: €${total}.`
                    }));
                }

                setTimeout(() => {
                    console.log('🔌 Cerrando llamada tras pedido finalizado...');
                    if (agentWs && agentWs.readyState === WebSocket.OPEN) agentWs.close();
                    if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close();
                }, 5000);

            } catch (error) {
                console.error('❌ Error guardando pedido:', error);
                if (agentWs && agentWs.readyState === WebSocket.OPEN) {
                    agentWs.send(JSON.stringify({
                        type: 'FunctionCallResponse',
                        id: functionCallId,
                        name: functionName,
                        content: 'Pedido anotado. Gracias.'
                    }));
                }
            }
        }
    }

    twilioWs.on('message', async (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return; }

        switch (data.event) {
            case 'start':
                streamSid = data.start.streamSid;
                clienteTelefono = data.start.customParameters?.From || 'Desconocido';
                activeBusiness = await getBusinessById(data.start.customParameters?.BusinessId || business.id) || business;
                console.log(`🆔 Stream iniciado. SID: ${streamSid} | Teléfono: ${clienteTelefono}`);

                await startCall({
                    id: streamSid,
                    businessId: activeBusiness.id,
                    phone: clienteTelefono
                });
                pedidoPrevio = await buscarPedidoPendientePorTelefono(clienteTelefono, activeBusiness.id);
                conectarVoiceAgent();
                break;

        case 'media':
                // CORRECCIÓN 4: Solo reenviar audio si el cerrojo lógico dice que Deepgram está listo.
                if (agentWs && agentWs.readyState === WebSocket.OPEN && agentReady) {

                    const audioBuffer = Buffer.from(data.media.payload, 'base64');

                    agentWs.send(audioBuffer);

                }

                break;

            case 'stop':
                console.log('🛑 Twilio detuvo el stream.');
                await cerrarRegistroLlamada('completed');
                if (agentWs && agentWs.readyState === WebSocket.OPEN) agentWs.close();
                break;
        }
    });

    twilioWs.on('close', () => {
        console.log('🔌 Canal de audio de Twilio cerrado.');
        cerrarRegistroLlamada('completed').catch(error => console.error('Error cerrando registro de llamada:', error));
        if (agentWs && agentWs.readyState === WebSocket.OPEN) agentWs.close();
    });

    twilioWs.on('error', (err) => {
        console.error('❌ Error en WebSocket de Twilio:', err.message);
        cerrarRegistroLlamada('failed').catch(error => console.error('Error marcando llamada fallida:', error));
    });

});

server.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`💻 Panel de cocina en: http://localhost:${PORT}/cocina\n`);
});
