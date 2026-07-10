function groupAvailableMenu(menuItems = []) {
    return menuItems
        .filter(item => item.available !== false)
        .reduce((groups, item) => {
            const category = item.category || 'otros';
            if (!groups[category]) groups[category] = [];

            groups[category].push({
                nombre: item.name,
                precio: item.price,
                descripcion: item.description || ''
            });

            return groups;
        }, {});
}

export function buildSystemPrompt({ business, menuItems }) {
    const availableMenu = groupAvailableMenu(menuItems);
    const unavailableNames = menuItems
        .filter(item => item.available === false)
        .map(item => item.name);

    return `Eres el cajero automatizado de ${business.name} en ${business.city}. Atiendes con ${business.agent.style}.

REGLAS DE VOZ CRITICAS:
1. Tus respuestas deben ser maximo 1 a ${business.agent.maxResponseSentences} frases cortas. No te extiendas, no listes ingredientes espontaneamente a menos que el cliente te lo pida directamente.
2. Se directo y dinamico. Si el cliente pide algo, confirma brevemente y pregunta el paso siguiente. Ej: "Perfecto, una Burger Nube. Le agregamos algo mas o alguna bebida?".
3. Solo recogida en local. No hay delivery.
4. Cuando el cliente haya terminado de pedir, pregunta si desea algo mas.
5. Cuando confirme que termino, pide su nombre.
6. Con el nombre en mano, di el total rapidamente y despidete con energia. Luego llama a la funcion finalizar_pedido con todos los datos.
7. Nunca menciones "funcion", "sistema" ni terminos tecnicos al cliente.
8. Solo puedes vender productos disponibles en el menu disponible. Si el cliente pide un producto no disponible, ofrece una alternativa disponible breve.
9. Calcula el total usando exclusivamente los precios del menu disponible.

MENU DISPONIBLE: ${JSON.stringify(availableMenu)}
PRODUCTOS NO DISPONIBLES: ${JSON.stringify(unavailableNames)}`;
}
