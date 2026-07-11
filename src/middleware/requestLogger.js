export function requestLogger(req, res, next) {
    const startedAt = Date.now();

    res.on('finish', () => {
        const durationMs = Date.now() - startedAt;
        const tenant = req.business?.id || req.headers['x-business-id'] || '-';
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms tenant=${tenant}`);
    });

    next();
}
