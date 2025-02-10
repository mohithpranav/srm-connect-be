import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const onlineUsers = new Map<number, string>();

const initializeSocketServer = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    const logOnlineUsers = () => {
      console.log("📊 Online users:", Array.from(onlineUsers.entries()));
    };

    // Handle user coming online
    socket.on("user-online", async (userId: number) => {
      console.log(`👤 User ${userId} coming online with socket ${socket.id}`);
      onlineUsers.set(userId, socket.id);
      await prisma.student.update({
        where: { id: userId },
        data: { isOnline: true },
      });

      // Notify connected users about online status
      socket.broadcast.emit("user-status-changed", { userId, isOnline: true });
      logOnlineUsers();
    });

    // Handle message sending
    socket.on("send-message", async ({ senderId, receiverId, content }) => {
      console.log(`📨 Message from ${senderId} to ${receiverId}: ${content}`);
      try {
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

        // Create message
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
        console.log("✅ Message sent confirmation emitted to sender");

        // Send to sender
        socket.emit("message-sent", message);

        // Send to receiver if online
        const receiverSocket = onlineUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket).emit("new-message", message);
          console.log(
            `✅ Message delivered to receiver socket ${receiverSocket}`
          );
        } else {
          console.log(
            `ℹ️ Receiver ${receiverId} is offline, message saved only`
          );
        }
      } catch (error) {
        console.error("Message sending error:", error);
        socket.emit("error", "Failed to send message");
      }
    });

    // Handle message read status
    socket.on("mark-messages-read", async ({ userId, senderId }) => {
      try {
        await prisma.message.updateMany({
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
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          await prisma.student.update({
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
    });
  });
};

export default initializeSocketServer;
