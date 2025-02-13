"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const onlineUsers = new Map();
const initializeSocketServer = (server) => {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (ws) => {
        console.log("🔌 New client connected");
        ws.isAlive = true;
        ws.on("pong", () => {
            ws.isAlive = true;
        });
        ws.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const data = JSON.parse(message);
                console.log("📩 Received message:", data);
                switch (data.type) {
                    case "user-online":
                        ws.userId = data.userId;
                        onlineUsers.set(data.userId, ws);
                        yield handleUserOnline(data.userId);
                        ws.send(JSON.stringify({
                            type: "connection-success",
                            userId: data.userId,
                        }));
                        break;
                    case "send-message":
                        yield handleSendMessage(ws, data);
                        break;
                    case "mark-messages-read":
                        yield handleMarkMessagesRead(data);
                        break;
                    case "fetch-chat-history":
                        yield handleFetchChatHistory(ws, data);
                        break;
                    case "get-notifications":
                        yield handleGetNotifications(ws, data.userId);
                        break;
                    default:
                        console.log("⚠️ Unknown message type:", data.type);
                }
            }
            catch (error) {
                console.error("❌ Error processing message:", error);
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Failed to process message",
                }));
            }
        }));
        ws.on("close", () => {
            console.log("🔌 Client disconnected");
            handleUserDisconnect(ws);
        });
        ws.on("error", (error) => {
            console.error("🔌 WebSocket error:", error);
        });
    });
    // Keep connections alive with ping-pong
    const interval = setInterval(() => {
        wss.clients.forEach((client) => {
            const ws = client;
            if (!ws.isAlive) {
                console.log("🔌 Terminating inactive connection");
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    wss.on("close", () => {
        clearInterval(interval);
    });
};
function handleUserOnline(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`👤 User ${userId} coming online`);
            yield prisma.student.update({
                where: { id: userId },
                data: { isOnline: true },
            });
            broadcastUserStatus(userId, true);
            console.log("📊 Current online users:", Array.from(onlineUsers.keys()));
        }
        catch (error) {
            console.error("❌ Error in handleUserOnline:", error);
        }
    });
}
function handleSendMessage(ws, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { senderId, receiverId, content } = data;
            console.log(`📨 Processing message from ${senderId} to ${receiverId}:`, content);
            // First, save message to database
            const message = yield prisma.message.create({
                data: {
                    content,
                    senderId,
                    receiverId,
                    isRead: false,
                },
                include: {
                    sender: {
                        select: {
                            firstName: true,
                            lastName: true,
                            profilePic: true,
                        },
                    },
                },
            });
            // Update connection with the new message
            const connection = yield prisma.connection.findFirst({
                where: {
                    OR: [
                        { requesterId: senderId, recipientId: receiverId },
                        { requesterId: receiverId, recipientId: senderId },
                    ],
                },
            });
            if (connection) {
                yield prisma.connection.update({
                    where: { id: connection.id },
                    data: {
                        messages: {
                            connect: { id: message.id },
                        },
                    },
                });
            }
            // Send confirmation to sender
            ws.send(JSON.stringify({
                type: "message-sent",
                message,
            }));
            // Check if receiver is online
            const receiverWs = onlineUsers.get(receiverId);
            if ((receiverWs === null || receiverWs === void 0 ? void 0 : receiverWs.readyState) === ws_1.WebSocket.OPEN) {
                console.log("📤 Sending message to online receiver:", receiverId);
                receiverWs.send(JSON.stringify({
                    type: "new-message",
                    message,
                }));
            }
            else {
                console.log("📥 Receiver is offline, message saved to DB:", receiverId);
                // Optionally increment unread count or create notification
                yield prisma.notification.upsert({
                    where: {
                        studentId_senderId: {
                            studentId: receiverId,
                            senderId: senderId,
                        },
                    },
                    update: {
                        count: {
                            increment: 1,
                        },
                    },
                    create: {
                        studentId: receiverId,
                        senderId: senderId,
                        count: 1,
                    },
                });
            }
        }
        catch (error) {
            console.error("❌ Error in handleSendMessage:", error);
            ws.send(JSON.stringify({
                type: "error",
                message: "Failed to send message",
            }));
        }
    });
}
function handleFetchChatHistory(ws, data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { userId, otherId } = data;
            const messages = yield prisma.message.findMany({
                where: {
                    OR: [
                        { senderId: userId, receiverId: otherId },
                        { senderId: otherId, receiverId: userId },
                    ],
                },
                include: {
                    sender: {
                        select: {
                            username: true,
                            profilePic: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            });
            ws.send(JSON.stringify({
                type: "chat-history",
                messages,
            }));
        }
        catch (error) {
            console.error("❌ Error fetching chat history:", error);
            ws.send(JSON.stringify({
                type: "error",
                message: "Failed to fetch chat history",
            }));
        }
    });
}
function handleMarkMessagesRead(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Mark messages as read
            yield prisma.message.updateMany({
                where: {
                    senderId: data.senderId,
                    receiverId: data.userId,
                    isRead: false,
                },
                data: {
                    isRead: true,
                    readAt: new Date(),
                },
            });
            // Reset notification count
            yield prisma.notification.update({
                where: {
                    studentId_senderId: {
                        studentId: data.userId,
                        senderId: data.senderId,
                    },
                },
                data: {
                    count: 0,
                },
            });
            // Send updated notification count to user
            const userWs = onlineUsers.get(data.userId);
            if (userWs) {
                const notifications = yield getUnreadNotifications(data.userId);
                userWs.send(JSON.stringify({
                    type: "notifications-update",
                    notifications,
                }));
            }
        }
        catch (error) {
            console.error("❌ Error marking messages as read:", error);
        }
    });
}
// Add function to get unread notifications
function getUnreadNotifications(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notifications = yield prisma.notification.findMany({
                where: {
                    studentId: userId,
                    count: {
                        gt: 0,
                    },
                },
                include: {
                    student: {
                        select: {
                            firstName: true,
                            lastName: true,
                            profilePic: true,
                        },
                    },
                },
            });
            return notifications;
        }
        catch (error) {
            console.error("❌ Error fetching notifications:", error);
            return [];
        }
    });
}
// Add a new function to get notification counts
function handleGetNotifications(ws, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notifications = yield prisma.notification.findMany({
                where: {
                    studentId: userId,
                },
                include: {
                    student: {
                        select: {
                            username: true,
                            profilePic: true,
                        },
                    },
                },
            });
            ws.send(JSON.stringify({
                type: "notifications",
                notifications,
            }));
        }
        catch (error) {
            console.error("❌ Error fetching notifications:", error);
            ws.send(JSON.stringify({
                type: "error",
                message: "Failed to fetch notifications",
            }));
        }
    });
}
function handleUserDisconnect(ws) {
    for (const [userId, userWs] of onlineUsers.entries()) {
        if (userWs === ws) {
            onlineUsers.delete(userId);
            broadcastUserStatus(userId, false);
            prisma.student
                .update({
                where: { id: userId },
                data: { isOnline: false },
            })
                .catch(console.error);
        }
    }
}
function broadcastUserStatus(userId, isOnline) {
    const message = JSON.stringify({
        type: "user-status-changed",
        userId,
        isOnline,
    });
    for (const ws of onlineUsers.values()) {
        ws.send(message);
    }
}
exports.default = initializeSocketServer;
