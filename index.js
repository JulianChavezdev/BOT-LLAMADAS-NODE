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
    listPendingOrders,
    updateOrder
} from './src/repositories/orderRepository.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 5050;
const business = defaultBusiness;

console.log("==========================================");
console.log("🔑 AUDITORÍA DE CREDENCIALES:");
console.log("Deepgram Key:", process.env.DEEPGRAM_API_KEY ? "✅ configurada" : "❌ NO DETECTADA");
console.log("OpenAI Key:", process.env.OPENAI_API_KEY ? "✅ configurada" : "❌ NO DETECTADA");
console.log("GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? "✅ configurada" : "❌ NO DETECTADA");
console.log("TWILIO_WHATSAPP_FROM:", process.env.TWILIO_WHATSAPP_FROM ? `✅ (${process.env.TWILIO_WHATSAPP_FROM})` : "❌ NO DETECTADA");
console.log("==========================================");

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
app.use(express.static(path.join(__dirname, 'public')));

const menu = bistroNubeMenu;
const SYSTEM_PROMPT = buildSystemPrompt({ business, menu });

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
app.get('/cocina', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cocina.html')));
app.post('/twilio-voice', (req, res) => {
    const numeroLlamante = req.body.From || 'Desconocido';
    res.type('text/xml');
    res.send(`
        <Response>
            <Say language="${business.voice.twilioLanguage}" voice="${business.voice.twilioVoice}">Conectando con el asistente de ${business.name}.</Say>
            <Connect>
                <Stream url="wss://${req.headers.host}/media-stream">
                    <Parameter name="From" value="${numeroLlamante}" />
                </Stream>
            </Connect>
        </Response>
    `);
});

app.get('/api/pedidos', async (req, res) => {
    const orders = await listPendingOrders();
    res.json(orders.map(order => ({
        id: order.id,
        nombre: order.customerName,
        telefono: order.phone,
        resumen: order.summary,
        total: order.total,
        estado: order.status
    })));
});
app.post('/cocina/completar', async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'id requerido' });
    }

    const order = await completeOrder(id);

    if (!order) {
        return res.status(404).json({ error: 'pedido no encontrado' });
    }

    res.json({ ok: true, order });
});

async function enviarMensajePedidoListo(telefono, nombre) { /* Tu lógica existente */ }
async function obtenerNombrePrimeraHoja(sheetsClient, sheetId) { /* Tu lógica existente */ }
async function buscarPedidoPendientePorTelefono(telefono) {
    return findPendingOrderByPhone(telefono);
}
async function guardarPedido(streamSid, cliente, comandaText, telefono, total) {
    return createOrder({
        id: streamSid,
        businessId: business.id,
        customerName: cliente,
        phone: telefono,
        summary: comandaText,
        total
    });
}
async function actualizarComandaExistente(orderId, cliente, nuevoResumen, total) {
    return updateOrder(orderId, {
        customerName: cliente,
        summary: nuevoResumen,
        total
    });
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
                model: business.voice.deepgramListenModel,
                language: business.voice.deepgramLanguage,
                smart_format: false
            }
        },
        think: {
            provider: {
                type: "open_ai",
                model: "gpt-4o-mini"
            },
            prompt: SYSTEM_PROMPT,
            functions: agentFunctions
        },
        speak: {
            provider: {
                type: "deepgram",
                model: business.voice.deepgramSpeakModel
            }
        },
        greeting: business.voice.greeting
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
                    await actualizarComandaExistente(pedidoPrevio.id, nombre_cliente, resumen_pedido, total);
                } else {
                    await guardarPedido(streamSid, nombre_cliente, resumen_pedido, clienteTelefono, total);
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
                console.log(`🆔 Stream iniciado. SID: ${streamSid} | Teléfono: ${clienteTelefono}`);

                pedidoPrevio = await buscarPedidoPendientePorTelefono(clienteTelefono);
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
                if (agentWs && agentWs.readyState === WebSocket.OPEN) agentWs.close();
                break;
        }
    });

    twilioWs.on('close', () => {
        console.log('🔌 Canal de audio de Twilio cerrado.');
        if (agentWs && agentWs.readyState === WebSocket.OPEN) agentWs.close();
    });

    twilioWs.on('error', (err) => console.error('❌ Error en WebSocket de Twilio:', err.message));
});

server.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`💻 Panel de cocina en: http://localhost:${PORT}/cocina\n`);
});
