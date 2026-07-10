import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

async function ensureStore() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
        await fs.access(ORDERS_FILE);
    } catch {
        await fs.writeFile(ORDERS_FILE, '[]', 'utf8');
    }
}

async function readOrders() {
    await ensureStore();
    const raw = await fs.readFile(ORDERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
}

async function writeOrders(orders) {
    await ensureStore();
    await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

export async function listOrders() {
    return readOrders();
}

export async function listPendingOrders() {
    const orders = await readOrders();
    return orders.filter(order => order.status === 'pending');
}

export async function findPendingOrderByPhone(phone) {
    if (!phone || phone === 'Desconocido') return null;

    const orders = await readOrders();
    return orders.find(order => order.phone === phone && order.status === 'pending') || null;
}

export async function createOrder({ id, businessId, customerName, phone, summary, total }) {
    const orders = await readOrders();
    const now = new Date().toISOString();
    const order = {
        id,
        businessId,
        customerName,
        phone,
        summary,
        total,
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };

    if (orders.some(existingOrder => existingOrder.id === id)) {
        return updateOrder(id, order);
    }

    orders.push(order);
    await writeOrders(orders);
    return order;
}

export async function updateOrder(id, updates) {
    const orders = await readOrders();
    const index = orders.findIndex(order => order.id === id);

    if (index === -1) return null;

    orders[index] = {
        ...orders[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    await writeOrders(orders);
    return orders[index];
}

export async function completeOrder(id) {
    return updateOrder(id, {
        status: 'completed',
        completedAt: new Date().toISOString()
    });
}
