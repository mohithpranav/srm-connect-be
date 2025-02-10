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
        // Add ping-pong to keep connection alive
        ws.isAlive = true;
        ws.on("pong", () => {
            ws.isAlive = true;
        });
        ws.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const data = JSON.parse(message.toString());
                console.log("📥 Received:", data);
                switch (data.type) {
                    case "user-online":
                        yield handleUserOnline(ws, data.userId);
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
                ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
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
function handleUserOnline(ws, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`👤 User ${userId} coming online`);
            // Store the WebSocket connection with the userId
            onlineUsers.set(userId, ws);
            // Store userId in WebSocket instance for easy reference
            ws.userId = userId;
            yield prisma.student.update({
                where: { id: userId },
                data: { isOnline: true },
            });
            broadcastUserStatus(userId, true);
            console.log("📊 Current online users:", Array.from(onlineUsers.keys()));
            // Send confirmation to the user
            ws.send(JSON.stringify({
                type: "connection-success",
                userId: userId,
            }));
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
            console.log(`📨 Processing message from ${senderId} to ${receiverId}`);
            // Verify both users exist
            const [sender, receiver] = yield Promise.all([
                prisma.student.findUnique({ where: { id: senderId } }),
                prisma.student.findUnique({ where: { id: receiverId } }),
            ]);
            if (!sender || !receiver) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: !sender ? "Sender not found" : "Receiver not found",
                }));
                return;
            }
            // Verify connection exists
            const connection = yield prisma.connection.findFirst({
                where: {
                    OR: [
                        { requesterId: senderId, recipientId: receiverId },
                        { requesterId: receiverId, recipientId: senderId },
                    ],
                    status: "ACCEPTED",
                },
            });
            if (!connection) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "No active connection found",
                }));
                return;
            }
            // Save message and update notification in a transaction
            const [message, notification] = yield prisma.$transaction((prisma) => __awaiter(this, void 0, void 0, function* () {
                // Create message
                const message = yield prisma.message.create({
                    data: {
                        senderId,
                        receiverId,
                        content,
                        connectionId: connection.id,
                    },
                    include: {
                        sender: {
                            select: {
                                username: true,
                                profilePic: true,
                            },
                        },
                    },
                });
                // Update or create notification
                const notification = yield prisma.notification.upsert({
                    where: {
                        studentId_senderId: {
                            studentId: receiverId,
                            senderId: senderId,
                        },
                    },
                    update: {
                        count: { increment: 1 },
                        lastMessage: new Date(),
                    },
                    create: {
                        studentId: receiverId,
                        senderId: senderId,
                        count: 1,
                        lastMessage: new Date(),
                    },
                });
                return [message, notification];
            }));
            // Prepare message payload
            const messagePayload = JSON.stringify({
                type: "new-message",
                message: Object.assign(Object.assign({}, message), { timestamp: new Date().toISOString() }),
            });
            // Send to sender (confirmation)
            ws.send(JSON.stringify({
                type: "message-sent",
                message: Object.assign(Object.assign({}, message), { timestamp: new Date().toISOString() }),
            }));
            console.log(`✅ Message sent confirmation to sender ${senderId}`);
            // Send to receiver if online
            const receiverWs = onlineUsers.get(receiverId);
            if (receiverWs && receiverWs.readyState === ws_1.WebSocket.OPEN) {
                try {
                    // Send new message to receiver
                    receiverWs.send(messagePayload);
                    console.log(`✅ Message delivered to receiver ${receiverId}`);
                    // Send notification update
                    receiverWs.send(JSON.stringify({
                        type: "notification-update",
                        notification: {
                            senderId,
                            count: notification.count,
                            lastMessage: new Date().toISOString(),
                        },
                    }));
                    console.log(`✅ Notification sent to receiver ${receiverId}`);
                }
                catch (error) {
                    console.error(`❌ Error sending to receiver ${receiverId}:`, error);
                    onlineUsers.delete(receiverId);
                }
            }
            else {
                console.log(`ℹ️ Receiver ${receiverId} is offline or connection is closed`);
            }
            // Log the message delivery status
            console.log(`📊 Message delivery status:
      Sender (${senderId}): ✅ Delivered
      Receiver (${receiverId}): ${receiverWs ? "✅ Delivered" : "❌ Offline"}
    `);
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
            const { userId, senderId } = data;
            // Update messages and clear notifications in a transaction
            yield prisma.$transaction((prisma) => __awaiter(this, void 0, void 0, function* () {
                // Mark messages as read
                yield prisma.message.updateMany({
                    where: {
                        receiverId: userId,
                        senderId: senderId,
                        isRead: false,
                    },
                    data: {
                        isRead: true,
                        readAt: new Date(),
                    },
                });
                // Clear notification for this sender
                yield prisma.notification.deleteMany({
                    where: {
                        studentId: userId,
                        senderId: senderId,
                    },
                });
            }));
            // Notify the reader about cleared notifications
            const readerWs = onlineUsers.get(userId);
            if (readerWs) {
                readerWs.send(JSON.stringify({
                    type: "notifications-cleared",
                    senderId,
                }));
            }
            // Notify the sender that messages were read
            const senderWs = onlineUsers.get(senderId);
            if (senderWs) {
                senderWs.send(JSON.stringify({
                    type: "messages-read",
                    by: userId,
                }));
            }
        }
        catch (error) {
            console.error("❌ Error in handleMarkMessagesRead:", error);
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
