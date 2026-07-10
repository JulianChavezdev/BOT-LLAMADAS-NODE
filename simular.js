import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5050');

ws.on('open', () => {
    console.log('[Simulador] Conectado al servidor de Bistro Nube.');

    const streamSid = 'TEST_LLAMADA_' + Math.floor(Math.random() * 1000);

    ws.send(JSON.stringify({
        event: 'start',
        start: {
            streamSid,
            customParameters: {
                From: '+34000000000'
            }
        }
    }));

    setTimeout(() => {
        console.log('Enviando consulta de menu...');
        ws.send(JSON.stringify({ event: 'test', text: 'Buenas, que platos tienen?' }));
    }, 1000);

    setTimeout(() => {
        console.log('Enviando pedido de ejemplo...');
        ws.send(JSON.stringify({ event: 'test', text: 'Quiero una Burger Nube con queso extra, unas croquetas de setas y una limonada casera' }));
    }, 5000);

    setTimeout(() => {
        console.log('Enviando cierre...');
        ws.send(JSON.stringify({ event: 'test', text: 'Mi nombre es Alex y paso a recogerlo en el local' }));
    }, 10000);
});

ws.on('message', (data) => {
    try {
        const mensaje = JSON.parse(data);
        if (mensaje.event === 'media') {
            console.log('[Servidor] Recibida respuesta de voz en formato MULAW.');
        }
    } catch (err) {
        // Ignorar mensajes no JSON.
    }
});

ws.on('close', () => {
    console.log('[Simulador] Conexion cerrada.');
});
