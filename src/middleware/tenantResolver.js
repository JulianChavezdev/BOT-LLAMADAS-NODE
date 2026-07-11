import { getBusinessById, getDefaultBusiness } from '../repositories/businessRepository.js';

function readTenantId(req) {
    return req.headers['x-business-id']
        || req.query.businessId
        || req.query.tenant
        || getDefaultBusiness().id;
}

export async function resolveTenant(req, res, next) {
    const tenantId = String(readTenantId(req)).trim();
    const business = await getBusinessById(tenantId);

    if (!business) {
        res.status(404).json({ error: 'negocio no encontrado' });
        return;
    }

    req.business = business;
    next();
}

export function resolveTenantId(req) {
    return String(readTenantId(req)).trim();
}
