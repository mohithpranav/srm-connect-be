"use strict";
// import express from "express";
// import http from "http";
// import dotenv from "dotenv";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import router from "./routes/authRoutes";
// import { initializeSocketServer } from "./controllers/socketServer";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// dotenv.config();
// const app = express();
// const server = http.createServer(app);
// // Middleware
// app.use(express.json());
// app.use(cors());
// app.use(helmet());
// app.use(morgan("dev"));
// app.use("/api", router);
// // ✅ Initialize WebSocket Server with correct type
// initializeSocketServer(server);
// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Server is running on http://localhost:${PORT}`);
// });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const prisma = new client_1.PrismaClient();
const onlineUsers = new Map();
// Middleware
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use("/api", authRoutes_1.default);
// ✅ Initialize WebSocket Server
const io = new socket_io_1.Server(server, {
    cors: { origin: "*" },
});
io.on("connection", (socket) => {
    console.log("🔌 A user connected:", socket.id);
    // Debug: Log all incoming events
    socket.onAny((eventName, ...args) => {
        console.log(`📥 Received event "${eventName}"`, args);
    });
    socket.on("user-online", (userId) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            console.log(`👤 User ${userId} coming online with socket ${socket.id}`);
            onlineUsers.set(userId, socket.id);
            // Debug: Log online users after each connection
            console.log("📊 Current online users:", Array.from(onlineUsers.entries()));
            yield prisma.student.update({
                where: { id: userId },
                data: { isOnline: true },
            });
            socket.broadcast.emit("user-status-changed", { userId, isOnline: true });
        }
        catch (error) {
            console.error("❌ Error in user-online:", error);
        }
    }));
    socket.on("send-message", (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            // Debug: Log the raw incoming message data
            console.log("📨 Received message data:", data);
            const { senderId, receiverId, content } = data;
            if (!senderId || !receiverId || !content) {
                console.error("❌ Missing required message fields");
                socket.emit("error", "Missing required message fields");
                return;
            }
            // Debug: Log the parsed message details
            console.log(`📝 Processing message from ${senderId} to ${receiverId}: ${content}`);
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
            // Debug: Log the found connection
            console.log("✅ Found connection:", connection);
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
            // Confirm to sender
            socket.emit("message-sent", message);
            console.log("✅ Confirmation sent to sender");
            // Send to receiver if online
            const receiverSocket = onlineUsers.get(receiverId);
            console.log(`📊 Receiver socket for ${receiverId}:`, receiverSocket);
            if (receiverSocket) {
                io.to(receiverSocket).emit("new-message", message);
                console.log(`✅ Message emitted to receiver socket ${receiverSocket}`);
            }
            else {
                console.log(`ℹ️ Receiver ${receiverId} is offline, message saved only`);
            }
        }
        catch (error) {
            console.error("❌ Error in send-message:", error);
            socket.emit("error", "Failed to send message");
        }
    }));
    socket.on("disconnect", () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
        // Find and remove disconnected user
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                console.log(`👤 User ${userId} is now offline`);
                socket.broadcast.emit("user-status-changed", {
                    userId,
                    isOnline: false,
                });
            }
        }
        // Debug: Log remaining online users
        console.log("📊 Remaining online users:", Array.from(onlineUsers.entries()));
    });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
