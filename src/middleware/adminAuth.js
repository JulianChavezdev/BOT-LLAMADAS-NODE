import crypto from 'crypto';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'bistro-demo';

function getCredentials() {
    return {
        username: process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD
    };
}

function safeCompare(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) return false;

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBasicAuth(header = '') {
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Basic' || !token) return null;

    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return null;

    return {
        username: decoded.slice(0, separatorIndex),
        password: decoded.slice(separatorIndex + 1)
    };
}

export function requireAdmin(req, res, next) {
    const expected = getCredentials();
    const provided = parseBasicAuth(req.headers.authorization);

    const authorized = provided
        && safeCompare(provided.username, expected.username)
        && safeCompare(provided.password, expected.password);

    if (authorized) {
        next();
        return;
    }

    res.set('WWW-Authenticate', 'Basic realm="Bistro Nube Admin"');
    res.status(401).send('Autenticacion requerida');
}

export function describeAdminAuth() {
    const usingDefaultCredentials = !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD;
    return {
        username: getCredentials().username,
        usingDefaultCredentials
    };
}
