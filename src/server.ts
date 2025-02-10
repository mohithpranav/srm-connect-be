// import express from "express";
// import http from "http";
// import dotenv from "dotenv";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import router from "./routes/authRoutes";
// import { initializeSocketServer } from "./controllers/socketServer";

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

import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import router from "./routes/authRoutes";

dotenv.config();
const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();
const onlineUsers = new Map<number, string>();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use("/api", router);

// ✅ Initialize WebSocket Server
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("🔌 A user connected:", socket.id);

  // Debug: Log all incoming events
  socket.onAny((eventName, ...args) => {
    console.log(`📥 Received event "${eventName}"`, args);
  });

  socket.on("user-online", async (userId: number) => {
    try {
      console.log(`👤 User ${userId} coming online with socket ${socket.id}`);
      onlineUsers.set(userId, socket.id);

      // Debug: Log online users after each connection
      console.log(
        "📊 Current online users:",
        Array.from(onlineUsers.entries())
      );

      await prisma.student.update({
        where: { id: userId },
        data: { isOnline: true },
      });

      socket.broadcast.emit("user-status-changed", { userId, isOnline: true });
    } catch (error) {
      console.error("❌ Error in user-online:", error);
    }
  });

  socket.on("send-message", async (data) => {
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
      console.log(
        `📝 Processing message from ${senderId} to ${receiverId}: ${content}`
      );

      // Verify connection exists
      const connection = await prisma.connection.findFirst({
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

      const message = await prisma.message.create({
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
      } else {
        console.log(`ℹ️ Receiver ${receiverId} is offline, message saved only`);
      }
    } catch (error) {
      console.error("❌ Error in send-message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

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
    console.log(
      "📊 Remaining online users:",
      Array.from(onlineUsers.entries())
    );
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
