import WebSocket from 'ws';

// Nos conectamos al servidor local en el puerto 5050
const ws = new WebSocket('ws://localhost:5050');

ws.on('open', () => {
    console.log('⚡ [Simulador] Conectado al servidor de Kriterios.');
    
    // Generamos un ID de llamada único para este test
    const streamSid = 'TEST_LLAMADA_' + Math.floor(Math.random() * 1000);

    // 1. Iniciamos la simulación
    ws.send(JSON.stringify({
        event: 'start',
        start: { streamSid: streamSid }
    }));

    // 2. Enviamos los mensajes simulados con tiempos para que la IA responda
    setTimeout(() => {
        console.log('➡️ Enviando saludo...');
        ws.send(JSON.stringify({ event: 'test', text: 'Buenas, ¿qué hamburguesas tienen?' }));
    }, 1000);

    setTimeout(() => {
        console.log('➡️ Pidiendo la comida...');
        ws.send(JSON.stringify({ event: 'test', text: 'Quiero una hamburguesa Martina sin cebolla, un Choriperro Calidoso y una Postobón de Manzana' }));
    }, 5000);

    setTimeout(() => {
        console.log('➡️ Dando los datos de cierre...');
        ws.send(JSON.stringify({ event: 'test', text: 'Mi nombre es Carlos y pasaré a recogerlo al local' }));
    }, 10000);
});

ws.on('message', (data) => {
    try {
        const mensaje = JSON.parse(data);
        if (mensaje.event === 'media') {
            console.log('🔊 [Servidor] Recibida respuesta de voz en formato MULAW (El bot está hablando...).');
        }
    } catch (err) {
        // Ignorar si llegan otros formatos
    }
});

ws.on('close', () => {
    console.log('🛑 [Simulador] Conexión cerrada.');
});