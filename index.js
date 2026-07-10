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

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 5050;

console.log("==========================================");
console.log("🔑 AUDITORÍA DE CREDENCIALES:");
console.log("Deepgram Key:", process.env.DEEPGRAM_API_KEY ? `✅ (Empieza por: ${process.env.DEEPGRAM_API_KEY.substring(0, 6)}...)` : "❌ NO DETECTADA");
console.log("OpenAI Key:", process.env.OPENAI_API_KEY ? `✅ (Empieza por: ${process.env.OPENAI_API_KEY.substring(0, 6)}...)` : "❌ NO DETECTADA");
console.log("GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? `✅ (Empieza por: ${process.env.GOOGLE_SHEET_ID.substring(0, 6)}...)` : "❌ NO DETECTADA");
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

// Memoria volátil para la interfaz de cocina
let comandasCocina = [];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// CARTA OFICIAL EN FORMATO JSON
// ==========================================
const KRI_MENU = {
    // ... [Tu JSON se mantiene exactamente igual] ...
    "hot_dogs": [
        { "nombre": "El Parce", "precio": 13.00, "ingredientes": ["Salchicha bockwurst", "Pan brioche", "Mix de cebolla en salsa", "Piña calada", "Tocineta dorada", "Queso mozzarella fundido", "Cebolla crispy", "Salsa Kriterio's"] },
        { "nombre": "Choriperro Calidoso", "precio": 13.00, "ingredientes": ["Salchicha bockwurst", "Chorizo criollo", "Salsa BBQ", "Pan brioche", "Pollo mechado", "Guacamole", "Queso mozzarella fundido", "Tocineta", "Cebolla crispy", "Salsa Kriterio's"] },
        { "nombre": "Venga Le Digo", "precio": 13.00, "ingredientes": ["Salchicha bockwurst", "Pan brioche", "Fajitas de vacuno", "Pico de gallo", "Queso mozzarella fundido", "Tocineta crispy caramelizada"] },
        { "nombre": "TQG", "precio": 13.00, "ingredientes": ["Salchicha bockwurst", "Pan bombón", "Queso mozzarella fundido", "Maíz tierno", "Queso fresco", "Piña calada", "Miel mostaza", "Salsa rosa", "Mermelada de maracuyá", "Bacon", "Tiras de jamón York"] },
        { "nombre": "Pa' Q' Se Lo Gocen", "precio": 14.00, "ingredientes": ["Pan bombón", "Salchicha bockwurst", "Chicharrón", "Pulled pork", "Maíz tierno salteado", "Queso mozzarella fundido al horno", "Triple bacon", "Doble salsa BBQ", "Salsa Kriterio's"] }
    ],
    "burgers": [
        { "nombre": "Sublime Gracia", "precio": 9.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Queso Gouda", "Tocineta", "Cebolla fresca", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Martina", "precio": 11.00, "acompañamiento": "Patatas", "ingredientes": ["150g pollo crispy", "Doble queso Gouda", "Tocineta", "Cebolla", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Cheese Burger", "precio": 12.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Queso Cheddar", "Queso Gouda", "Queso de cabra", "Tocineta", "Cebolla", "Lechuga", "Piña calada", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Pork", "precio": 12.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "120g panceta en BBQ", "Queso Gouda", "Tocineta", "Cebolla fresca", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Ave María Parce", "precio": 12.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Queso Gouda", "Tocineta", "Arepita amarilla", "Chorizo colombiano", "Guacamole", "Cebolla al grill", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Mi Arma", "precio": 12.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Doble queso Gouda", "Champiñones salteados al ajillo", "Chorizo ahumado", "Jamón serrano", "Cebolla fresca", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Americana", "precio": 13.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Queso Gouda", "Doble tocineta", "Aros de cebolla rebozados", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "VIP", "precio": 13.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "100g brazo de cerdo mechado al horno", "Maduro frito", "Chorizo pork en BBQ", "Queso Gouda", "Cebolla fresca", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Bombastic", "precio": 13.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "100g pollo al grill", "Queso Gouda", "Tocineta", "Aros de cebolla", "Chorizo", "Aguacate", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Frikitona", "precio": 13.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Huevo", "Chorizo colombiano", "Aguacate", "Maíz tierno", "Queso Gouda", "Tocineta", "Cebolla fresca", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] },
        { "nombre": "Mi Chiquita Brava", "precio": 13.00, "acompañamiento": "Patatas", "ingredientes": ["130g carne de vacuno", "Arepita amarilla", "Pico de gallo", "Chicharrón", "Tocineta crispy", "Guacamole", "Queso Gouda", "Lechuga", "Tomate fresco", "Pan brioche artesanal", "Salsa Kriterio's"] }
    ],
    "desgranados": [
        { "nombre": "El Montañero", "precios": { "individual": 14.00, "familiar": 18.00 }, "ingredientes": ["Base de lechuga", "Maíz tierno", "Pollo mechado", "Cerdo mechado", "Chorizo criollo", "Salchicha lonjas", "Queso mozzarella fundido", "Tocineta", "Salsa Kriterio's"] }
    ],
    "arepas_rellenas": [
        { "nombre": "Sugar Mommy", "precio": 9.00, "ingredientes": ["Arepa", "Queso de relleno", "Tocineta", "Piña calada", "Queso mozzarella fundido", "Salsa Kriterio's"] },
        { "nombre": "La Boquisabrosa", "precio": 10.00, "ingredientes": ["Arepa", "Cerdo mechado", "Chimichurri", "Puré de maduro", "Cebolla crunchy", "Salsa Kriterio's"] },
        { "nombre": "La Colombiana", "precio": 12.00, "ingredientes": ["Arepa", "Pollo mechado", "Cerdo mechado", "Chicharrón", "Hogao", "Guacamole", "Queso mozzarella fundido", "Salsa Kriterio's"] }
    ],
    "tostadas_platano_macho": [
        { "nombre": "Banana Ranch", "precio": 15.00, "ingredientes": ["Plátano macho crujiente", "Guacamole", "Pollo mechado en BBQ", "Cerdo mechado en BBQ", "Chorizo", "Panceta ahumada", "Maíz tierno", "Queso mozzarella fundido"] },
        { "nombre": "Las Visajosas", "precio": 13.00, "ingredientes": ["Dos tostadas de plátano macho", "Pollo mechado", "Cerdo mechado", "Chicharrón", "Hogao", "Guacamole", "Queso mozzarella fundido"] }
    ],
    "maduro_gratinado": [
        { "nombre": "El Sugar Daddy", "precio": 10.00, "ingredientes": ["Plátano maduro", "Queso mozzarella fundido", "Queso cheddar fundido", "Maíz tierno", "Tocineta", "Salsa Kriterio's"] }
    ],
    "salchipapa": [
        { "nombre": "La Combi Completa", "precios": { "individual": 14.00, "familiar": 18.00 }, "ingredientes": ["Patatas fritas", "Salchicha en lonjas con salsa BBQ", "Queso mozzarella fundido", "Cerdo mechado", "Pollo mechado", "Tocineta", "Guacamole", "Pico de gallo", "Triple salsa a elegir"] }
    ],
    "entrantes": [
        { "nombre": "Patatas (Porción)", "precio": 3.00 },
        { "nombre": "Patatas Cheddar y Tocineta", "precio": 5.00 },
        { "nombre": "Nuggets de Pollo", "precio": 5.00 },
        { "nombre": "Alitas a la BBQ", "precio": 5.00 },
        { "nombre": "Empanadas Colombianas (x4)", "precio": 5.00 },
        { "nombre": "Tequeños (x4)", "precio": 5.00 }
    ],
    "bebidas": {
        "batidos_leche": [
            { "sabor": "Mora", "precio": 6.00 }, { "sabor": "Mango", "precio": 6.00 },
            { "sabor": "Guanábana", "precio": 6.00 }, { "sabor": "Lulo", "precio": 6.00 }, { "sabor": "Maracuyá", "precio": 6.00 }
        ],
        "batidos_agua": [
            { "sabor": "Mora", "precio": 5.00 }, { "sabor": "Mango", "precio": 5.00 },
            { "sabor": "Guanábana", "precio": 5.00 }, { "sabor": "Lulo", "precio": 5.00 }, { "sabor": "Maracuyá", "precio": 5.00 }
        ],
        "refrescos": [
            { "nombre": "Coca-Cola", "precio": 1.70 }, { "nombre": "Coca-Cola Zero", "precio": 1.70 },
            { "nombre": "Nestea", "precio": 1.70 }, { "nombre": "Fanta de Naranja", "precio": 1.70 },
            { "nombre": "Fanta de Limón", "precio": 1.70 }, { "nombre": "Aquarius", "precio": 1.70 },
            { "nombre": "Agua", "precio": 1.00 }, { "nombre": "Gaseosa Postobón (Uva/Manzana)", "precio": 2.80 },
            { "nombre": "Jugos Hit", "precio": 2.80 }
        ]
    },
    "adiciones": [
        { "nombre": "Carne de Hamburguesa", "precio": 3.50 }, { "nombre": "Queso", "precio": 2.00 },
        { "nombre": "Queso de Cabra", "precio": 2.00 }, { "nombre": "Tocineta", "precio": 2.00 },
        { "nombre": "Cebolla Caramelizada", "precio": 2.00 }, { "nombre": "Piña Calada", "precio": 2.00 },
        { "nombre": "Panceta Chicharrón", "precio": 2.50 }, { "nombre": "Chorizo", "precio": 2.50 },
        { "nombre": "Guacamole", "precio": 2.00 }, { "nombre": "Pico de Gallo", "precio": 2.00 },
        { "nombre": "Champiñones", "precio": 2.00 }, { "nombre": "Maduro Frito", "precio": 2.00 },
        { "nombre": "Maicitos", "precio": 2.00 }, { "nombre": "Tocineta Crispy", "precio": 2.50 },
        { "nombre": "Fajitas de Carne", "precio": 3.00 }, { "nombre": "Pollo Mechado", "precio": 2.50 },
        { "nombre": "Cebolla Crispy", "precio": 2.50 }
    ]
};

// ==========================================
// DEFINICIÓN DE FUNCIONES PARA EL VOICE AGENT
// ==========================================
const AGENT_FUNCTIONS = [
    {
        name: "finalizar_pedido",
        description: "Llama esta función ÚNICAMENTE cuando el cliente haya confirmado todos sus productos, hayas preguntado si quiere algo más y te haya dado su nombre. Extrae el resumen completo del pedido y el total.",
        parameters: {
            type: "object",
            properties: {
                nombre_cliente: { type: "string", description: "Nombre del cliente tal como lo dijo" },
                resumen_pedido: { type: "string", description: "Lista detallada de todos los productos pedidos con cantidades y adiciones. Ejemplo: '1x Hamburguesa Martina + Queso extra, 1x Batido de Mora con leche, 1x Coca-Cola'" },
                total: { type: "number", description: "Total exacto en euros calculado sumando todos los productos y adiciones" }
            },
            required: ["nombre_cliente", "resumen_pedido", "total"]
        }
    }
];

const SYSTEM_PROMPT = `Eres el cajero automatizado de Kriterio's Burger en Sevilla. Atiendes con excelente energía, alegre y con acento colombiano amigable.

REGLAS DE LOCUCIÓN DE VOZ (CRÍTICAS):
1. TUS RESPUESTAS DEBEN SER MÁXIMO 1 A 2 FRASES CORTAS. No te extiendas, no listes ingredientes espontáneamente a menos que el cliente te lo pida directamente.
2. Sé directo y dinámico. Si el cliente pide algo, confirma brevemente y pregunta el paso siguiente. Ej: "¡De una! Una Martina. ¿Le agregamos algo más o alguna bebida?".
3. Solo recogida en local. No hay delivery.
4. Cuando el cliente haya terminado de pedir, pregunta si desea algo más.
5. Cuando confirme que terminó, pide su nombre.
6. Con el nombre en mano, di el total rápidamente y despídete con energía. Luego llama a la función finalizar_pedido con todos los datos.
7. Nunca menciones "función", "sistema" ni términos técnicos al cliente.

MENÚ COMPLETO: ${JSON.stringify(KRI_MENU)}`;

// ==========================================
// RUTAS HTTP Y FUNCIONES DE NEGOCIO SE MANTIENEN IGUALES
// ==========================================
app.get('/cocina', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cocina.html')));
app.post('/twilio-voice', (req, res) => {
    const numeroLlamante = req.body.From || 'Desconocido';
    res.type('text/xml');
    res.send(`
        <Response>
            <Say language="es-MX" voice="Polly.Mia">Conectando con el asistente de Kriterios Burger.</Say>
            <Connect>
                <Stream url="wss://${req.headers.host}/media-stream">
                    <Parameter name="From" value="${numeroLlamante}" />
                </Stream>
            </Connect>
        </Response>
    `);
});

app.get('/api/pedidos', (req, res) => res.json(comandasCocina));
app.post('/cocina/completar', async (req, res) => { /* Tu lógica existente de despacho */ });

async function enviarMensajePedidoListo(telefono, nombre) { /* Tu lógica existente */ }
async function obtenerNombrePrimeraHoja(sheetsClient, sheetId) { /* Tu lógica existente */ }
async function buscarPedidoPendientePorTelefono(telefono) { /* Tu lógica existente */ }
async function guardarPedidoEnSheets(streamSid, cliente, comandaText, telefono) { /* Tu lógica existente */ }
async function actualizarComandaExistenteEnSheets(fila, nuevoResumen) { /* Tu lógica existente */ }
async function actualizarEstadoEnSheets(streamSid, nuevoEstado) { /* Tu lógica existente */ }

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
                model: "nova-3",
                language: "es",
                smart_format: false
            }
        },
        think: {
            provider: {
                type: "open_ai",
                model: "gpt-4o-mini"
            },
            prompt: SYSTEM_PROMPT,
            functions: AGENT_FUNCTIONS
        },
        speak: {
            provider: {
                type: "deepgram",
                model: "aura-2-gloria-es"
            }
        },
        greeting: "Hola, Kriterio's Burger, habla tu asistente. ¿Qué te provoca pedir hoy?"
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
                    comandasCocina = comandasCocina.filter(c => c.id !== pedidoPrevio.streamSidAnterior);
                    comandasCocina.push({ id: streamSid, nombre: nombre_cliente, telefono: clienteTelefono, resumen: resumen_pedido });
                    await actualizarComandaExistenteEnSheets(pedidoPrevio.fila, resumen_pedido);
                } else {
                    comandasCocina.push({ id: streamSid, nombre: nombre_cliente, telefono: clienteTelefono, resumen: resumen_pedido });
                    await guardarPedidoEnSheets(streamSid, nombre_cliente, resumen_pedido, clienteTelefono);
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
