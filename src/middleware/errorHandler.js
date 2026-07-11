export function notFoundHandler(req, res) {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'ruta no encontrada' });
        return;
    }

    res.status(404).send('Not found');
}

export function errorHandler(error, req, res, next) {
    console.error('Error HTTP no controlado:', error);

    if (res.headersSent) {
        next(error);
        return;
    }

    if (req.path.startsWith('/api')) {
        res.status(500).json({ error: 'error interno' });
        return;
    }

    res.status(500).send('Error interno');
}
