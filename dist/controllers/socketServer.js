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
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const onlineUsers = new Map();
const initializeSocketServer = (server) => {
    const io = new socket_io_1.Server(server, {
        cors: { origin: "*" },
    });
    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);
        const logOnlineUsers = () => {
            console.log("📊 Online users:", Array.from(onlineUsers.entries()));
        };
        // Handle user coming online
        socket.on("user-online", (userId) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`👤 User ${userId} coming online with socket ${socket.id}`);
            onlineUsers.set(userId, socket.id);
            yield prisma.student.update({
                where: { id: userId },
                data: { isOnline: true },
            });
            // Notify connected users about online status
            socket.broadcast.emit("user-status-changed", { userId, isOnline: true });
            logOnlineUsers();
        }));
        // Handle message sending
        socket.on("send-message", (_a) => __awaiter(void 0, [_a], void 0, function* ({ senderId, receiverId, content }) {
            console.log(`📨 Message from ${senderId} to ${receiverId}: ${content}`);
            try {
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
                    console.log("❌ No active connection found between users");
                    socket.emit("error", "No active connection found");
                    return;
                }
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
                console.log("✅ Message saved to database:", message);
                console.log("✅ Message sent confirmation emitted to sender");
                // Send to sender
                socket.emit("message-sent", message);
                // Send to receiver if online
                const receiverSocket = onlineUsers.get(receiverId);
                if (receiverSocket) {
                    io.to(receiverSocket).emit("new-message", message);
                    console.log(`✅ Message delivered to receiver socket ${receiverSocket}`);
                }
                else {
                    console.log(`ℹ️ Receiver ${receiverId} is offline, message saved only`);
                }
            }
            catch (error) {
                console.error("Message sending error:", error);
                socket.emit("error", "Failed to send message");
            }
        }));
        // Handle message read status
        socket.on("mark-messages-read", (_a) => __awaiter(void 0, [_a], void 0, function* ({ userId, senderId }) {
            try {
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
                // Notify sender that messages were read
                const senderSocket = onlineUsers.get(senderId);
                if (senderSocket) {
                    io.to(senderSocket).emit("messages-read", { by: userId });
                }
            }
            catch (error) {
                console.error("Error marking messages as read:", error);
            }
        }));
        // Handle disconnection
        socket.on("disconnect", () => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`🔌 Socket disconnected: ${socket.id}`);
            for (const [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    onlineUsers.delete(userId);
                    yield prisma.student.update({
                        where: { id: userId },
                        data: { isOnline: false },
                    });
                    // Notify others about offline status
                    socket.broadcast.emit("user-status-changed", {
                        userId,
                        isOnline: false,
                    });
                }
            }
        }));
    });
};
exports.default = initializeSocketServer;
