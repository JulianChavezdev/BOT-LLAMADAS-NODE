import { getPrisma } from '../db/prisma.js';
import * as jsonStore from './jsonOrderStore.js';
import { defaultBusiness } from '../config/businesses.js';

let prismaUnavailable = false;

function serializeCall(call) {
    if (!call) return null;

    return {
        ...call,
        startedAt: call.startedAt instanceof Date ? call.startedAt.toISOString() : call.startedAt,
        endedAt: call.endedAt instanceof Date ? call.endedAt.toISOString() : call.endedAt,
        createdAt: call.createdAt instanceof Date ? call.createdAt.toISOString() : call.createdAt,
        updatedAt: call.updatedAt instanceof Date ? call.updatedAt.toISOString() : call.updatedAt
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
        console.warn('Prisma no disponible para llamadas, usando JSON:', error.message);
        return fallback();
    }
}

async function ensureBusiness(prisma, businessId) {
    if (businessId !== defaultBusiness.id) return;

    await prisma.business.upsert({
        where: { id: defaultBusiness.id },
        update: {
            name: defaultBusiness.name,
            city: defaultBusiness.city,
            country: defaultBusiness.country,
            locale: defaultBusiness.locale,
            timezone: defaultBusiness.timezone,
            serviceMode: defaultBusiness.serviceMode
        },
        create: {
            id: defaultBusiness.id,
            name: defaultBusiness.name,
            city: defaultBusiness.city,
            country: defaultBusiness.country,
            locale: defaultBusiness.locale,
            timezone: defaultBusiness.timezone,
            serviceMode: defaultBusiness.serviceMode
        }
    });
}

async function upsertCustomer(prisma, { businessId, phone }) {
    if (!phone || phone === 'Desconocido') return null;

    return prisma.customer.upsert({
        where: {
            businessId_phone: {
                businessId,
                phone
            }
        },
        update: {},
        create: {
            businessId,
            phone
        }
    });
}

export async function startCall({ id, businessId, phone, provider = 'twilio' }) {
    return withPrisma(
        async (prisma) => {
            await ensureBusiness(prisma, businessId);
            const customer = await upsertCustomer(prisma, { businessId, phone });

            const call = await prisma.call.upsert({
                where: { id },
                update: {
                    customerId: customer?.id,
                    phone,
                    provider,
                    status: 'active'
                },
                create: {
                    id,
                    businessId,
                    customerId: customer?.id,
                    phone,
                    provider,
                    status: 'active'
                }
            });

            return serializeCall(call);
        },
        () => jsonStore.createCall({ id, businessId, phone, provider })
    );
}

export async function finishCall(id, status = 'completed') {
    return withPrisma(
        async (prisma) => {
            const call = await prisma.call.update({
                where: { id },
                data: {
                    status,
                    endedAt: new Date()
                }
            });

            return serializeCall(call);
        },
        () => jsonStore.finishCall(id, status)
    );
}
