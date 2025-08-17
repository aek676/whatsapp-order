import { Client, RemoteAuth, type Message } from 'whatsapp-web.js';
import { SupabaseStore } from './supabase/supabase-store';
import { registerWhatsappCommands, removePedido } from './lib/whatsapp';
const qrcode = require('qrcode-terminal');

const establishmentId = 'c7831588-4953-40c5-bdcf-02809d8a2370';

/** ===================== Tipos y store en memoria ===================== */
const wwebVersion = '2.2412.54';

/**
 * Mapeo de messageId (mensaje enviado por el bot al listar pedidos)
 * -> pedidoId.
 */
const msgToPedidoPerChat: Map<string, Map<string, number>> = new Map();

/** ===================== Helpers ===================== */
function resetMapForChat(chatId: string) {
    msgToPedidoPerChat.set(chatId, new Map());
}
function mapMsgToPedido(chatId: string, msgId: string, pedidoId: number) {
    const m = msgToPedidoPerChat.get(chatId) ?? new Map();
    m.set(msgId, pedidoId);
    msgToPedidoPerChat.set(chatId, m);
}
function getPedidoIdFromMsg(chatId: string, msgId: string) {
    return msgToPedidoPerChat.get(chatId)?.get(msgId);
}

/** ===================== Cliente WhatsApp ===================== */
const remoteStore = new SupabaseStore();
const client = new Client({
    authStrategy: new RemoteAuth({
        store: remoteStore,
        backupSyncIntervalMs: 6000000,
        clientId: establishmentId
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

client.on('ready', () => {
    console.log(`WhatsApp client ready for establishment: ${establishmentId}`);
});
client.on('qr', (qr: string) => {
    qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => {
    console.log(`Client authenticated for establishment: ${establishmentId}`);
});
client.on('auth_failure', (msg) => {
    console.error(`Authentication failed for establishment ${establishmentId}:`, msg);
});

/** ===================== Handlers ===================== */
// Solo comando: !pedidos
client.on('message_create', async (message: Message) => {
    console.log(`Received message: ${message.body} from ${message.from}`);
    try {
        const command = message.body.trim();
        const chatId = message.fromMe ? message.to : message.from;
        const plan = await registerWhatsappCommands(command, chatId);

        switch (plan.kind) {
            case 'noop':
                return;
            case 'reply':
                await message.reply(plan.text);
                return;
            case 'list_pedidos':
                resetMapForChat(chatId);
                await client.sendMessage(chatId, plan.header);

                for (const item of plan.items) {
                    const sent = await client.sendMessage(chatId, item.text);
                    mapMsgToPedido(chatId, sent.id._serialized, item.pedidoId);
                }

                await client.sendMessage(chatId, plan.footer);
                return;
            default:
                break;
        }
    } catch (e) {
        console.error('Error handling message:', e);
        try { await message.reply('Error procesando tu solicitud ❌'); } catch { }
    }
});

/**
 * Reacciones: ✅ borra el pedido
 */
client.on('message_reaction', async (reaction: any) => {
    try {
        if (reaction?.reaction !== '✅') return;
        const reactedMsgId: string | undefined = reaction?.msgId?._serialized;
        const chatId: string | undefined = reaction?.senderId;
        if (!reactedMsgId || !chatId) return;

        const pedidoId = getPedidoIdFromMsg(chatId, reactedMsgId);
        if (!pedidoId) return;

        const p = removePedido(chatId, pedidoId);
        if (p) {
            await client.sendMessage(chatId, `Pedido #${pedidoId} borrado 🗑️`);
        }
    } catch (e) {
        console.error('Error procesando message_reaction:', e);
    }
});

client.initialize();
