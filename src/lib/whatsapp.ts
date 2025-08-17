type ChatId = string;

type PedidoLinea =
    | { kind: 'producto'; nombre: string; cant: number }
    | { kind: 'menu'; nombre: string; items: Array<{ nombre: string; cant: number }> };

interface Pedido {
    id: number;
    line: PedidoLinea;
}

let nextId = 1;

const storeMem: Map<ChatId, Pedido[]> = new Map([
    [
        'c7831588-4953-40c5-bdcf-02809d8a2370',
        [
            { id: nextId++, line: { kind: 'producto', nombre: 'Pizza muzza', cant: 2 } },
            { id: nextId++, line: { kind: 'producto', nombre: 'Empanada carne', cant: 12 } },
            {
                id: nextId++,
                line: {
                    kind: 'menu',
                    nombre: 'Combo Familiar',
                    items: [
                        { nombre: 'Pizza napolitana', cant: 1 },
                        { nombre: 'Empanadas J&Q', cant: 6 },
                        { nombre: 'Gaseosa 1.5L', cant: 2 }
                    ]
                }
            },
            { id: nextId++, line: { kind: 'producto', nombre: 'Fainá', cant: 1 } }
        ]
    ]
]);

export const msgToPedido: Map<string, number> = new Map();

/** ===================== Helpers ===================== */
function listPedidos(chat: ChatId): Pedido[] {
    return storeMem.get(chat) ?? [];
}
function setPedidos(chat: ChatId, pedidos: Pedido[]) {
    storeMem.set(chat, pedidos);
}
export function removePedido(chat: ChatId, pedidoId: number): Pedido | null {
    const arr = listPedidos(chat);
    const i = arr.findIndex(x => x.id === pedidoId);
    if (i === -1) return null;
    const [r] = arr.splice(i, 1);
    setPedidos(chat, arr);
    return r ?? null;
}

function renderPedido(p: Pedido): string {
    const base =
        p.line.kind === 'producto'
            ? `${p.line.nombre} (x${p.line.cant})`
            : `MENÚ ${p.line.nombre}: ` +
            p.line.items.map(i => `${i.nombre} (x${i.cant})`).join(', ');
    return `#${p.id} · ${base}`;
}

/** Seed de ejemplo por chat (solo si está vacío) */
function seedIfEmpty(chat: ChatId) {
    if (listPedidos(chat).length) return;
    setPedidos(chat, [
        { id: nextId++, line: { kind: 'producto', nombre: 'Pizza muzza', cant: 2 } },
        { id: nextId++, line: { kind: 'producto', nombre: 'Empanada carne', cant: 12 } },
        {
            id: nextId++,
            line: {
                kind: 'menu',
                nombre: 'Combo Familiar',
                items: [
                    { nombre: 'Pizza napolitana', cant: 1 },
                    { nombre: 'Empanadas J&Q', cant: 6 },
                    { nombre: 'Gaseosa 1.5L', cant: 2 }
                ]
            }
        },
        { id: nextId++, line: { kind: 'producto', nombre: 'Fainá', cant: 1 } }
    ]);
}

/** -------- PLAN DE ACCIONES -------- */
type CommandPlan =
    | { kind: 'noop' }
    | { kind: 'reply', text: string }
    | {
        kind: 'list_pedidos',
        header: string,
        items: Array<{ text: string; pedidoId: number }>,
        footer: string
    };

/**
 * Decide qué hacer según el comando y prepara un plan a ejecutar.
 */
export async function registerWhatsappCommands(
    command: string,
    chatId: ChatId
): Promise<CommandPlan> {
    switch (command) {
        case '📋': {
            seedIfEmpty(chatId);
            const pedidos = listPedidos(chatId);

            // limpiamos el mapeo (lo real ejecuta el caller)
            for (const [key] of msgToPedido) msgToPedido.delete(key);

            if (!pedidos.length) {
                return { kind: 'reply', text: 'No tienes pedidos.' };
            }

            return {
                kind: 'list_pedidos',
                header: 'Estos son los pedidos:',
                items: pedidos.map(p => ({ text: renderPedido(p), pedidoId: p.id })),
                footer: 'Reacciona con ✅ en el mensaje del pedido para BORRARLO.'
            };
        }

        case '!borrar':
            // ejemplo de otro comando
            return { kind: 'reply', text: 'Tus datos han sido borrados.' };

        default:
            return { kind: 'noop' };
    }
}
