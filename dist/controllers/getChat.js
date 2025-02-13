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
exports.getUserChats = exports.getLastMessage = exports.getChat = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get chat history between two users
const getChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, otherId } = req.params;
        const messages = yield prisma.message.findMany({
            where: {
                OR: [
                    { senderId: parseInt(userId), receiverId: parseInt(otherId) },
                    { senderId: parseInt(otherId), receiverId: parseInt(userId) },
                ],
            },
            orderBy: {
                createdAt: "asc",
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
        res.json(messages);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});
exports.getChat = getChat;
// Get last message between two users
const getLastMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, otherId } = req.params;
        const lastMessage = yield prisma.message.findFirst({
            where: {
                OR: [
                    { senderId: parseInt(userId), receiverId: parseInt(otherId) },
                    { senderId: parseInt(otherId), receiverId: parseInt(userId) },
                ],
            },
            orderBy: {
                createdAt: "desc",
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
        const unreadCount = yield prisma.message.count({
            where: {
                senderId: parseInt(otherId),
                receiverId: parseInt(userId),
                isRead: false,
            },
        });
        res.json({
            lastMessage,
            unreadCount,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch last message" });
    }
});
exports.getLastMessage = getLastMessage;
// Get all chats for a user with last messages
const getUserChats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        // Get all connections for the user
        const connections = yield prisma.connection.findMany({
            where: {
                OR: [
                    { requesterId: parseInt(userId) },
                    { recipientId: parseInt(userId) },
                ],
                status: "ACCEPTED",
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePic: true,
                        isOnline: true,
                    },
                },
                recipient: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        profilePic: true,
                        isOnline: true,
                    },
                },
            },
        });
        // Get last message and unread count for each connection
        const chatsWithMessages = yield Promise.all(connections.map((conn) => __awaiter(void 0, void 0, void 0, function* () {
            const otherId = conn.requesterId === parseInt(userId)
                ? conn.recipientId
                : conn.requesterId;
            const lastMessage = yield prisma.message.findFirst({
                where: {
                    OR: [
                        { senderId: parseInt(userId), receiverId: otherId },
                        { senderId: otherId, receiverId: parseInt(userId) },
                    ],
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
            const unreadCount = yield prisma.message.count({
                where: {
                    senderId: otherId,
                    receiverId: parseInt(userId),
                    isRead: false,
                },
            });
            const otherUser = conn.requesterId === parseInt(userId)
                ? conn.recipient
                : conn.requester;
            return {
                id: conn.id,
                user: otherUser,
                lastMessage: lastMessage
                    ? {
                        content: lastMessage.content,
                        createdAt: lastMessage.createdAt,
                        unreadCount,
                    }
                    : null,
            };
        })));
        // Sort by last message time
        const sortedChats = chatsWithMessages.sort((a, b) => {
            if (!a.lastMessage)
                return 1;
            if (!b.lastMessage)
                return -1;
            return (new Date(b.lastMessage.createdAt).getTime() -
                new Date(a.lastMessage.createdAt).getTime());
        });
        res.json({
            chats: sortedChats,
        });
    }
    catch (error) {
        console.error("Error fetching user chats:", error);
        res.status(500).json({ error: "Failed to fetch user chats" });
    }
});
exports.getUserChats = getUserChats;
