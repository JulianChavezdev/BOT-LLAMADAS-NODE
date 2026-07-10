import { getPrisma } from '../db/prisma.js';
import * as jsonStore from './jsonOrderStore.js';
import { defaultBusiness } from '../config/businesses.js';

let prismaUnavailable = false;

function serializeOrder(order) {
    if (!order) return null;

    return {
        ...order,
        createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
        updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
        completedAt: order.completedAt instanceof Date ? order.completedAt.toISOString() : order.completedAt
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
        console.warn('Prisma no disponible, usando almacenamiento JSON:', error.message);
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

async function upsertCustomer(prisma, { businessId, customerName, phone }) {
    if (!phone || phone === 'Desconocido') return null;

    return prisma.customer.upsert({
        where: {
            businessId_phone: {
                businessId,
                phone
            }
        },
        update: {
            name: customerName
        },
        create: {
            businessId,
            phone,
            name: customerName
        }
    });
}

export async function listOrders() {
    return withPrisma(
        async (prisma) => {
            const orders = await prisma.order.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return orders.map(serializeOrder);
        },
        () => jsonStore.listOrders()
    );
}

export async function listPendingOrders() {
    return withPrisma(
        async (prisma) => {
            const orders = await prisma.order.findMany({
                where: { status: 'pending' },
                orderBy: { createdAt: 'asc' }
            });
            return orders.map(serializeOrder);
        },
        () => jsonStore.listPendingOrders()
    );
}

export async function findPendingOrderByPhone(phone) {
    return withPrisma(
        async (prisma) => {
            if (!phone || phone === 'Desconocido') return null;

            const order = await prisma.order.findFirst({
                where: {
                    phone,
                    status: 'pending'
                },
                orderBy: { createdAt: 'desc' }
            });

            return serializeOrder(order);
        },
        () => jsonStore.findPendingOrderByPhone(phone)
    );
}

export async function createOrder({ id, businessId, customerName, phone, summary, total }) {
    return withPrisma(
        async (prisma) => {
            await ensureBusiness(prisma, businessId);
            const customer = await upsertCustomer(prisma, { businessId, customerName, phone });

            const order = await prisma.order.upsert({
                where: { id },
                update: {
                    customerId: customer?.id,
                    customerName,
                    phone,
                    summary,
                    total,
                    status: 'pending'
                },
                create: {
                    id,
                    businessId,
                    customerId: customer?.id,
                    customerName,
                    phone,
                    summary,
                    total,
                    status: 'pending'
                }
            });

            return serializeOrder(order);
        },
        () => jsonStore.createOrder({ id, businessId, customerName, phone, summary, total })
    );
}

export async function updateOrder(id, updates) {
    return withPrisma(
        async (prisma) => {
            const order = await prisma.order.update({
                where: { id },
                data: updates
            });

            return serializeOrder(order);
        },
        () => jsonStore.updateOrder(id, updates)
    );
}

export async function completeOrder(id) {
    return withPrisma(
        async (prisma) => {
            const order = await prisma.order.update({
                where: { id },
                data: {
                    status: 'completed',
                    completedAt: new Date()
                }
            });

            return serializeOrder(order);
        },
        () => jsonStore.completeOrder(id)
    );
}
