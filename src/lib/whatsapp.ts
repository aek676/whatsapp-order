// lib/whatsapp.ts
import supabase from "../supabase/client";

type EstablishmentId = string;

type PedidoLinea =
    | { kind: 'producto'; nombre: string; cant: number }
    | { kind: 'menu'; nombre: string; items: Array<{ nombre: string; cant: number }> };

interface Pedido {
    id: number;
    line: PedidoLinea;
}

let nextId = 1;

// ✅ store por establecimiento
const storeMem: Map<EstablishmentId, Pedido[]> = new Map([
    [
        'c7831588-4953-40c5-bdcf-02809d8a2370', // <- ejemplo de establishmentId
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
function listPedidos(establishmentId: EstablishmentId): Pedido[] {
    return storeMem.get(establishmentId) ?? [];
}
function setPedidos(establishmentId: EstablishmentId, pedidos: Pedido[]) {
    storeMem.set(establishmentId, pedidos);
}

// ✅ borrar por establecimiento
export function removePedidoByEst(establishmentId: EstablishmentId, pedidoId: number): Pedido | null {
    const arr = listPedidos(establishmentId);
    const i = arr.findIndex(x => x.id === pedidoId);
    if (i === -1) return null;
    const [r] = arr.splice(i, 1);
    setPedidos(establishmentId, arr);
    return r ?? null;
}

function renderPedido(p: Pedido): string {
    const base =
        p.line.kind === 'producto'
            ? `${p.line.nombre} (x${p.line.cant})`
            : `MENÚ ${p.line.nombre}: ` + p.line.items.map(i => `${i.nombre} (x${i.cant})`).join(', ');
    return `#${p.id} · ${base}`;
}

/** Seed de ejemplo por establecimiento (solo si está vacío) */
function seedIfEmpty(establishmentId: EstablishmentId) {
    if (listPedidos(establishmentId).length) return;
    setPedidos(establishmentId, [
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

// (Asegúrate de tener el tipo de chat, aquí asumo:)
type ChatData = { id_chat: string; role: 'customer' | 'staff' };

export async function registerWhatsappCommands(
    command: string,
    establishmentId: string,
    chat: ChatData
): Promise<CommandPlan> {
    if (chat.role !== 'staff') {
        return { kind: 'noop' };
    }

    switch (command) {
        case '📋': {
            seedIfEmpty(establishmentId);
            const pedidos = listPedidos(establishmentId);

            for (const [key] of msgToPedido) msgToPedido.delete(key);

            if (!pedidos.length) {
                return { kind: 'reply', text: 'No hay pedidos del establecimiento.' };
            }

            return {
                kind: 'list_pedidos',
                header: 'Pedidos del establecimiento:',
                items: pedidos.map(p => ({ text: renderPedido(p), pedidoId: p.id })),
                footer: 'Reacciona con ✅ en el mensaje del pedido para BORRARLO.'
            };
        }

        case '!borrar':
            return { kind: 'reply', text: 'Tus datos han sido borrados.' };

        default:
            return { kind: 'noop' };
    }
}
