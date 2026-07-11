import { defaultBusiness } from '../config/businesses.js';
import { getPrisma } from '../db/prisma.js';

let prismaUnavailable = false;

function mergeBusiness(dbBusiness) {
    return {
        ...defaultBusiness,
        ...dbBusiness,
        voice: defaultBusiness.voice,
        agent: defaultBusiness.agent
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
    return defaultBusiness;
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
        () => (id === defaultBusiness.id ? defaultBusiness : null)
    );
}
