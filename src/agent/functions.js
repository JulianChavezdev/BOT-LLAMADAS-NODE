export const agentFunctions = [
    {
        name: "finalizar_pedido",
        description: "Llama esta funcion unicamente cuando el cliente haya confirmado todos sus productos, hayas preguntado si quiere algo mas y te haya dado su nombre. Extrae el resumen completo del pedido y el total.",
        parameters: {
            type: "object",
            properties: {
                nombre_cliente: {
                    type: "string",
                    description: "Nombre del cliente tal como lo dijo"
                },
                resumen_pedido: {
                    type: "string",
                    description: "Lista detallada de todos los productos pedidos con cantidades y extras. Ejemplo: '1x Burger Nube + Queso extra, 1x Croquetas de setas, 1x Limonada casera'"
                },
                total: {
                    type: "number",
                    description: "Total exacto en euros calculado sumando todos los productos y extras"
                }
            },
            required: ["nombre_cliente", "resumen_pedido", "total"]
        }
    }
];
