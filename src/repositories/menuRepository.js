import crypto from 'crypto';
import { getPrisma } from '../db/prisma.js';
import { bistroNubeMenu } from '../config/menus/bistroNubeMenu.js';

let prismaUnavailable = false;
const fallbackAvailability = new Map();
const fallbackOverrides = new Map();
const fallbackDeleted = new Set();
const fallbackCreated = [];

function slug(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function fallbackItems() {
    const configuredItems = Object.entries(bistroNubeMenu).flatMap(([category, items]) => {
        if (!Array.isArray(items)) return [];

        return items.map(item => {
            const id = `${category}:${slug(item.nombre)}`;
            const baseItem = {
                id,
                category,
                name: item.nombre,
                description: [
                    item.acompanamiento ? `Incluye ${item.acompanamiento}` : null,
                    Array.isArray(item.ingredientes) ? item.ingredientes.join(', ') : null
                ].filter(Boolean).join('. '),
                price: item.precio,
                available: fallbackAvailability.has(id) ? fallbackAvailability.get(id) : true
            };

            return {
                ...baseItem,
                ...fallbackOverrides.get(id)
            };
        });
    });

    return [...configuredItems, ...fallbackCreated]
        .filter(item => !fallbackDeleted.has(item.id));
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
        console.warn('Prisma no disponible para menu, usando configuracion local:', error.message);
        return fallback();
    }
}

export async function listMenuItems(businessId) {
    return withPrisma(
        (prisma) => prisma.menuItem.findMany({
            where: { businessId },
            orderBy: [
                { category: 'asc' },
                { name: 'asc' }
            ]
        }),
        () => fallbackItems()
    );
}

export async function setMenuItemAvailability({ businessId, id, available }) {
    return withPrisma(
        async (prisma) => {
            const result = await prisma.menuItem.updateMany({
                where: { id, businessId },
                data: { available }
            });

            if (result.count === 0) return null;

            return prisma.menuItem.findUnique({ where: { id } });
        },
        () => {
            const item = fallbackItems().find(menuItem => menuItem.id === id);
            if (!item) return null;

            fallbackAvailability.set(id, available);
            return {
                ...item,
                businessId,
                available
            };
        }
    );
}

export async function createMenuItem({ businessId, category, name, description = '', price, available = true }) {
    return withPrisma(
        (prisma) => prisma.menuItem.create({
            data: {
                businessId,
                category,
                name,
                description,
                price,
                available
            }
        }),
        () => {
            const item = {
                id: `custom:${crypto.randomUUID()}`,
                businessId,
                category,
                name,
                description,
                price,
                available
            };

            fallbackCreated.push(item);
            return item;
        }
    );
}

export async function updateMenuItem({ businessId, id, category, name, description, price }) {
    const data = {
        ...(category ? { category } : {}),
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(price !== undefined ? { price } : {})
    };

    return withPrisma(
        async (prisma) => {
            const result = await prisma.menuItem.updateMany({
                where: { id, businessId },
                data
            });

            if (result.count === 0) return null;

            return prisma.menuItem.findUnique({ where: { id } });
        },
        () => {
            const item = fallbackItems().find(menuItem => menuItem.id === id);
            if (!item) return null;

            const updated = { ...item, ...data, businessId };
            const createdIndex = fallbackCreated.findIndex(menuItem => menuItem.id === id);

            if (createdIndex >= 0) {
                fallbackCreated[createdIndex] = updated;
            } else {
                fallbackOverrides.set(id, data);
            }

            return updated;
        }
    );
}

export async function deleteMenuItem({ businessId, id }) {
    return withPrisma(
        async (prisma) => {
            const result = await prisma.menuItem.deleteMany({
                where: { id, businessId }
            });

            return result.count > 0;
        },
        () => {
            const item = fallbackItems().find(menuItem => menuItem.id === id);
            if (!item) return false;

            const createdIndex = fallbackCreated.findIndex(menuItem => menuItem.id === id);
            if (createdIndex >= 0) {
                fallbackCreated.splice(createdIndex, 1);
            } else {
                fallbackDeleted.add(id);
            }

            return true;
        }
    );
}
