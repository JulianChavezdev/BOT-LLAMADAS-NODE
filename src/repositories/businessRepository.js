import { defaultBusiness } from '../config/businesses.js';
import { getPrisma } from '../db/prisma.js';

let prismaUnavailable = false;
const fallbackBusinessOverrides = new Map();

function mergeBusiness(dbBusiness) {
    const overrides = fallbackBusinessOverrides.get(dbBusiness.id) || {};
    const source = {
        ...dbBusiness,
        ...overrides
    };

    return {
        ...defaultBusiness,
        ...source,
        voice: {
            greeting: source.voiceGreeting || defaultBusiness.voice.greeting,
            twilioLanguage: source.twilioLanguage || defaultBusiness.voice.twilioLanguage,
            twilioVoice: source.twilioVoice || defaultBusiness.voice.twilioVoice,
            deepgramSpeakModel: source.deepgramSpeakModel || defaultBusiness.voice.deepgramSpeakModel,
            deepgramListenModel: source.deepgramListenModel || defaultBusiness.voice.deepgramListenModel,
            deepgramLanguage: source.deepgramLanguage || defaultBusiness.voice.deepgramLanguage
        },
        agent: {
            style: source.agentStyle || defaultBusiness.agent.style,
            maxResponseSentences: source.agentMaxResponseSentences || defaultBusiness.agent.maxResponseSentences
        }
    };
}

async function withPrisma(operation, fallback) {
    const prisma = getPrisma();

    if (!prisma || prismaUnavailable) {
        return fallback();
    }

    try {
        return await operation(prisma);
    } catch (error) {
        prismaUnavailable = true;
        console.warn('Prisma no disponible para negocios, usando configuracion local:', error.message);
        return fallback();
    }
}

export function getDefaultBusiness() {
    return mergeBusiness(defaultBusiness);
}

export async function getBusinessById(id = defaultBusiness.id) {
    return withPrisma(
        async (prisma) => {
            const business = await prisma.business.findUnique({
                where: { id }
            });

            if (!business) {
                return id === defaultBusiness.id ? defaultBusiness : null;
            }

            return mergeBusiness(business);
        },
        () => (id === defaultBusiness.id ? mergeBusiness(defaultBusiness) : null)
    );
}

export async function updateBusiness({
    id,
    name,
    city,
    serviceMode,
    voiceGreeting,
    twilioLanguage,
    twilioVoice,
    deepgramSpeakModel,
    deepgramListenModel,
    deepgramLanguage,
    agentStyle,
    agentMaxResponseSentences
}) {
    const data = {
        ...(name ? { name } : {}),
        ...(city ? { city } : {}),
        ...(serviceMode ? { serviceMode } : {}),
        ...(voiceGreeting ? { voiceGreeting } : {}),
        ...(twilioLanguage ? { twilioLanguage } : {}),
        ...(twilioVoice ? { twilioVoice } : {}),
        ...(deepgramSpeakModel ? { deepgramSpeakModel } : {}),
        ...(deepgramListenModel ? { deepgramListenModel } : {}),
        ...(deepgramLanguage ? { deepgramLanguage } : {}),
        ...(agentStyle ? { agentStyle } : {}),
        ...(agentMaxResponseSentences ? { agentMaxResponseSentences } : {})
    };

    return withPrisma(
        async (prisma) => {
            const result = await prisma.business.updateMany({
                where: { id },
                data
            });

            if (result.count === 0) return null;

            const business = await prisma.business.findUnique({ where: { id } });
            return mergeBusiness(business);
        },
        () => {
            if (id !== defaultBusiness.id) return null;

            fallbackBusinessOverrides.set(id, {
                ...(fallbackBusinessOverrides.get(id) || {}),
                ...data
            });

            return mergeBusiness(defaultBusiness);
        }
    );
}
