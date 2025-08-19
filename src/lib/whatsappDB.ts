import { getProduct, removeOrder } from "../supabase/databaseRepository";
import { getOrdersWithEstablishment } from "../supabase/getDataEstablishments";



export function removePedidoByEst(establishmentId: string, pedidoId: string) {
    console.log(`Removing pedido ${pedidoId} for establishment ${establishmentId}`);
    return removeOrder(pedidoId.toString());
}

async function renderPedido(p: OrderWithDetails): Promise<string> {
    const fmtMoney = (value: number | string | null | undefined) => {
        const num = typeof value === 'number' ? value : Number(value ?? 0);
        try {
            return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
        } catch {
            return `${num.toFixed(2)} €`;
        }
    };

    const safe = (s: string | null | undefined, fallback = '') =>
        (s ?? fallback).toString().trim();

    const isPickup = !!p.is_pickup;

    // Encabezado bonito
    const statusIcon = '⏳';
    const entregaIcon = isPickup ? '🏃‍♂️' : '🏠';
    const entregaText = isPickup
        ? 'Recoger en local'
        : `A domicilio${p.address ? ` · ${safe(p.address)}` : ''}`;

    const headerLines = [
        `*${statusIcon} Pedido #${p.id_order}*`,
        `👤 *Cliente:* ${safe(p.name, 'Cliente')}`,
        `💶 *Total:* ${fmtMoney((p as any).price)}`,
        `${entregaIcon} *Entrega:* ${entregaText || '(sin dirección)'}`
    ];

    if (!p.details_order || p.details_order.length === 0) {
        return headerLines.join('\n') + `\n\n— (sin productos)`;
    }

    const lineas: string[] = await Promise.all(
        p.details_order.map(async (d: any) => {
            const qty = d.quantity ? ` x${d.quantity}` : '';

            if (d.products) {
                const nombre = safe(d.products.name, '(producto)');
                return `• ${nombre}${qty}`;
            }

            if (d.menus) {
                const menuName = safe(d.menus.name, 'MENÚ');

                if (Array.isArray(d.selected_products) && d.selected_products.length > 0) {
                    const ids: string[] = Array.from(
                        new Set(
                            d.selected_products
                                .map((id: any) => String(id).trim())
                                .filter(Boolean)
                        )
                    );

                    const products = await Promise.all(ids.map((id) => getProduct(id)));

                    const items = products.map((prod: any) => (prod.name));

                    const prettyLines = items.map((name: any) => `      - ${name}`).join('\n');

                    return `• 🍽️ *MENÚ ${menuName}*${qty}\n${prettyLines}`;

                }

                const count = d.selected_products?.length ?? 0;
                return `• 🍽️ *MENÚ ${menuName}*${qty}\n   ↳ ${count} seleccionados`;
            }

            return '• (detalle sin datos)';
        })
    );

    return [
        headerLines.join('\n'),
        '',
        '*Detalles:*',
        lineas.join('\n'),
        '',
    ].join('\n');
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

            const ordersPending = (await getOrdersWithEstablishment(establishmentId)).filter(o => o.status === 'preparing');

            if (!ordersPending.length) {
                return { kind: 'reply', text: 'No hay pedidos del establecimiento.' };
            }

            return {
                kind: 'list_pedidos',
                header: 'Pedidos del establecimiento:',
                items: await Promise.all(ordersPending.map(async p => ({ text: await renderPedido(p), pedidoId: p.id_order }))),
                footer: 'Reacciona con ✅ en el mensaje del pedido para marcarlo como hecho.'
            };
        }

        case '!borrar':
            return { kind: 'reply', text: 'Tus datos han sido borrados.' };

        default:
            return { kind: 'noop' };
    }
}
