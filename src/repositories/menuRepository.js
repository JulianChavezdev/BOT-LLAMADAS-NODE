import { getPrisma } from '../db/prisma.js';
import { bistroNubeMenu } from '../config/menus/bistroNubeMenu.js';

let prismaUnavailable = false;
const fallbackAvailability = new Map();

function slug(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function fallbackItems() {
    return Object.entries(bistroNubeMenu).flatMap(([category, items]) => {
        if (!Array.isArray(items)) return [];

        return items.map(item => {
            const id = `${category}:${slug(item.nombre)}`;
            return {
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
        });
    });
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
