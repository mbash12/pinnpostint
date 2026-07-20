import { io, type Socket } from "socket.io-client";
import { config } from "@/config/environment";

export type ConversationUpdatedPayload = {
    id: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadDelta?: number;
};

type ConvHandler = (payload: ConversationUpdatedPayload) => void;

/** Strip /api/v1 so the client hits the same HTTP origin as Socket.IO. */
export function getChatSocketBaseUrl(): string {
    let base = config.api.url.replace(/\/?api\/v\d+\/?$/i, "");
    if (!base) {
        base = config.api.url;
    }
    if (base.includes("127.0.0.1")) {
        base = base.replace("127.0.0.1", "localhost");
    }
    return base.replace(/\/$/, "");
}

class AdminChatSocketManager {
    private socket: Socket | null = null;
    private token: string | null = null;
    private readonly handlers = new Set<ConvHandler>();

    private readonly onServerPayload = (payload: ConversationUpdatedPayload) => {
        for (const h of this.handlers) {
            try {
                h(payload);
            } catch {
                // ignore subscriber errors
            }
        }
    };

    ensureConnected(token: string): void {
        if (!token) {
            return;
        }
        if (this.socket?.connected && this.token === token) {
            return;
        }
        this.disconnect();
        this.token = token;
        this.socket = io(getChatSocketBaseUrl(), {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
        });
        this.socket.on("conversation_updated", this.onServerPayload);
    }

    onConversationUpdated(handler: ConvHandler): () => void {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.off("conversation_updated", this.onServerPayload);
            this.socket.disconnect();
            this.socket = null;
        }
        this.token = null;
    }
}

export const adminChatSocket = new AdminChatSocketManager();
