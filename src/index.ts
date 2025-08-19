import { Client, LocalAuth, RemoteAuth, type Message } from 'whatsapp-web.js';
import puppeteer from 'puppeteer';
import { SupabaseStore } from './supabase/supabase-store';
import { registerWhatsappCommands, removePedidoByEst } from './lib/whatsappDB';
import { insertChat, markOrderAsDone } from './supabase/databaseRepository';
const qrcode = require('qrcode-terminal');

const establishmentId = 'c7831588-4953-40c5-bdcf-02809d8a2370';

/**
 * Mapeo de messageId (mensaje enviado por el bot al listar pedidos)
 * -> pedidoId.
 */
const msgToPedidoPerChat: Map<string, Map<string, string>> = new Map();

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
    deviceName: "Test local",
    authStrategy: new LocalAuth({
    }),
    puppeteer: {
        // Prueba primero 'new'. Si siguiera molestando, cambia a 'shell' o a true.
        headless: true,
        executablePath: puppeteer.executablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    },
    // *** IMPORTANTE ***
    // Cachea la versión de WhatsApp Web en local para que NO la redescubra
    // en cada arranque (el redescubrimiento es cuando navega y se rompe el contexto).
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
    const phone_number = message.from.replace(/@c\.us$/, '');
    console.log(`Received message: ${message.body} from ${phone_number}`);
    if (phone_number.length > 12) return;
    try {
        const chat = await insertChat({
            id_establishment: establishmentId,
            phone_number: phone_number
        });

        const command = message.body.trim();
        const chatId = message.fromMe ? message.to : message.from;
        const plan = await registerWhatsappCommands(command, establishmentId, chat);

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
        console.log('Error procesando tu solicitud ❌', e);
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

        const p = await markOrderAsDone(pedidoId, establishmentId);

        let reactedMsg = await client.getMessageById(reactedMsgId);

        if (p) {
            await reactedMsg.reply(`Pedido *#${pedidoId}* marcado como hecho correctamente ✅`);
            return;
        }

        await reactedMsg.reply(`No se pudo marcar el pedido *#${pedidoId}* como hecho.`);
    } catch (e) {
        console.error('Error procesando message_reaction:', e);
    }
});

client.initialize();
