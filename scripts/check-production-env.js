import dotenv from 'dotenv';

dotenv.config();

const required = [
    'DATABASE_URL',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    'DEEPGRAM_API_KEY',
    'OPENAI_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_WHATSAPP_FROM'
];

const missing = required.filter(key => !process.env[key]);
const failures = [];

if (missing.length > 0) {
    failures.push(`Faltan variables: ${missing.join(', ')}`);
}

if (process.env.ADMIN_USERNAME === 'admin' || process.env.ADMIN_PASSWORD === 'bistro-demo') {
    failures.push('ADMIN_USERNAME/ADMIN_PASSWORD no deben usar credenciales demo en produccion');
}

if (process.env.DATABASE_URL?.startsWith('file:')) {
    failures.push('DATABASE_URL usa SQLite local; para produccion usa Postgres gestionado');
}

if (process.env.TWILIO_WHATSAPP_FROM && !process.env.TWILIO_WHATSAPP_FROM.startsWith('whatsapp:')) {
    failures.push('TWILIO_WHATSAPP_FROM debe empezar por whatsapp:');
}

if (failures.length > 0) {
    console.error('Variables de produccion invalidas:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('Variables de produccion OK.');
