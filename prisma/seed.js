import { PrismaClient } from '@prisma/client';
import { defaultBusiness } from '../src/config/businesses.js';
import { bistroNubeMenu } from '../src/config/menus/bistroNubeMenu.js';

const prisma = new PrismaClient();

function normalizeMenuItems(menu) {
    return Object.entries(menu).flatMap(([category, items]) => {
        if (!Array.isArray(items)) return [];

        return items.map(item => ({
            category,
            name: item.nombre,
            description: [
                item.acompanamiento ? `Incluye ${item.acompanamiento}` : null,
                Array.isArray(item.ingredientes) ? item.ingredientes.join(', ') : null
            ].filter(Boolean).join('. '),
            price: item.precio,
            metadata: JSON.stringify(item)
        }));
    });
}

async function main() {
    await prisma.business.upsert({
        where: { id: defaultBusiness.id },
        update: {
            name: defaultBusiness.name,
            city: defaultBusiness.city,
            country: defaultBusiness.country,
            locale: defaultBusiness.locale,
            timezone: defaultBusiness.timezone,
            serviceMode: defaultBusiness.serviceMode,
            voiceGreeting: defaultBusiness.voice.greeting,
            twilioLanguage: defaultBusiness.voice.twilioLanguage,
            twilioVoice: defaultBusiness.voice.twilioVoice,
            deepgramSpeakModel: defaultBusiness.voice.deepgramSpeakModel,
            deepgramListenModel: defaultBusiness.voice.deepgramListenModel,
            deepgramLanguage: defaultBusiness.voice.deepgramLanguage,
            agentStyle: defaultBusiness.agent.style,
            agentMaxResponseSentences: defaultBusiness.agent.maxResponseSentences
        },
        create: {
            id: defaultBusiness.id,
            name: defaultBusiness.name,
            city: defaultBusiness.city,
            country: defaultBusiness.country,
            locale: defaultBusiness.locale,
            timezone: defaultBusiness.timezone,
            serviceMode: defaultBusiness.serviceMode,
            voiceGreeting: defaultBusiness.voice.greeting,
            twilioLanguage: defaultBusiness.voice.twilioLanguage,
            twilioVoice: defaultBusiness.voice.twilioVoice,
            deepgramSpeakModel: defaultBusiness.voice.deepgramSpeakModel,
            deepgramListenModel: defaultBusiness.voice.deepgramListenModel,
            deepgramLanguage: defaultBusiness.voice.deepgramLanguage,
            agentStyle: defaultBusiness.agent.style,
            agentMaxResponseSentences: defaultBusiness.agent.maxResponseSentences
        }
    });

    await prisma.menuItem.deleteMany({
        where: { businessId: defaultBusiness.id }
    });

    await prisma.menuItem.createMany({
        data: normalizeMenuItems(bistroNubeMenu).map(item => ({
            ...item,
            businessId: defaultBusiness.id
        }))
    });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
