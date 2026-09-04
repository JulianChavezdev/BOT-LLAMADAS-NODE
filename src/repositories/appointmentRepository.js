import crypto from 'crypto';
import { getPrisma } from '../db/prisma.js';
import { defaultBusiness } from '../config/businesses.js';

let prismaUnavailable = false;
const fallbackServices = new Map();
const fallbackAppointments = [];

function serialize(value) {
    if (!value) return null;
    return {
        ...value,
        startsAt: value.startsAt instanceof Date ? value.startsAt.toISOString() : value.startsAt,
        createdAt: value.createdAt instanceof Date ? value.createdAt.toISOString() : value.createdAt,
        updatedAt: value.updatedAt instanceof Date ? value.updatedAt.toISOString() : value.updatedAt
    };
}

async function withPrisma(operation, fallback) {
    const prisma = getPrisma();
    if (!prisma || prismaUnavailable) return fallback();
    try { return await operation(prisma); } catch (error) {
        prismaUnavailable = true;
        console.warn('Prisma no disponible para reservas:', error.message);
        return fallback();
    }
}

export function listServices(businessId = defaultBusiness.id) {
    return withPrisma(
        prisma => prisma.service.findMany({ where: { businessId }, orderBy: { name: 'asc' } }),
        () => [...fallbackServices.values()].filter(service => service.businessId === businessId)
    );
}

export function createService({ businessId, name, description, price, durationMinutes, available = true }) {
    return withPrisma(
        prisma => prisma.service.create({ data: { businessId, name, description, price, durationMinutes, available } }),
        () => {
            const service = { id: `service-${crypto.randomUUID()}`, businessId, name, description, price, durationMinutes, available };
            fallbackServices.set(service.id, service);
            return service;
        }
    );
}

export function updateService(id, businessId, data) {
    return withPrisma(
        async prisma => {
            const result = await prisma.service.updateMany({ where: { id, businessId }, data });
            return result.count ? prisma.service.findUnique({ where: { id } }) : null;
        },
        () => {
            const current = fallbackServices.get(id);
            if (!current || current.businessId !== businessId) return null;
            const updated = { ...current, ...data };
            fallbackServices.set(id, updated);
            return updated;
        }
    );
}

export function deleteService(id, businessId) {
    return withPrisma(
        async prisma => (await prisma.service.deleteMany({ where: { id, businessId } })).count > 0,
        () => Boolean(fallbackServices.delete(id))
    );
}

export function listAppointments(businessId = defaultBusiness.id) {
    return withPrisma(
        prisma => prisma.appointment.findMany({ where: { businessId }, include: { service: true }, orderBy: { startsAt: 'asc' } }).then(items => items.map(serialize)),
        () => fallbackAppointments.filter(item => item.businessId === businessId).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    );
}

export async function createAppointment({ id = `appointment-${crypto.randomUUID()}`, businessId, serviceId, customerName, phone, startsAt, durationMinutes = 30, notes = '' }) {
    const start = new Date(startsAt);
    if (Number.isNaN(start.valueOf())) throw new Error('startsAt invalido');

    const overlapping = await listAppointments(businessId);
    const requestedEnd = start.getTime() + durationMinutes * 60000;
    if (overlapping.some(item => item.status !== 'cancelled' && start < new Date(item.startsAt).getTime() + item.durationMinutes * 60000 && requestedEnd > new Date(item.startsAt).getTime())) {
        throw new Error('horario no disponible');
    }

    return withPrisma(
        prisma => prisma.appointment.create({ data: { id, businessId, serviceId, customerName, phone, startsAt: start, durationMinutes, notes, status: 'pending' }, include: { service: true } }).then(serialize),
        () => {
            const appointment = { id, businessId, serviceId, customerName, phone, startsAt: start.toISOString(), durationMinutes, notes, status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            fallbackAppointments.push(appointment);
            return appointment;
        }
    );
}

export function updateAppointment(id, businessId, data) {
    return withPrisma(
        async prisma => {
            const result = await prisma.appointment.updateMany({ where: { id, businessId }, data });
            return result.count ? prisma.appointment.findUnique({ where: { id }, include: { service: true } }).then(serialize) : null;
        },
        () => {
            const appointment = fallbackAppointments.find(item => item.id === id && item.businessId === businessId);
            if (!appointment) return null;
            Object.assign(appointment, data, { updatedAt: new Date().toISOString() });
            return appointment;
        }
    );
}
