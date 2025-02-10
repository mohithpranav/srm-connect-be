import { WebSocket, WebSocketServer } from "ws";
import { Server as HttpServer } from "http";
import { PrismaClient } from "@prisma/client";

interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
  userId?: number;
}

const prisma = new PrismaClient();
const onlineUsers = new Map<number, CustomWebSocket>();

const initializeSocketServer = (server: HttpServer) => {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: CustomWebSocket) => {
    console.log("🔌 New client connected");

    // Add ping-pong to keep connection alive
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("📥 Received:", data);

        switch (data.type) {
          case "user-online":
            await handleUserOnline(ws, data.userId);
            break;

          case "send-message":
            await handleSendMessage(ws, data);
            break;

          case "mark-messages-read":
            await handleMarkMessagesRead(data);
            break;

          case "fetch-chat-history":
            await handleFetchChatHistory(ws, data);
            break;

          case "get-notifications":
            await handleGetNotifications(ws, data.userId);
            break;

          default:
            console.log("⚠️ Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("❌ Error processing message:", error);
        ws.send(
          JSON.stringify({ type: "error", message: "Invalid message format" })
        );
      }
    });

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
      const ws = client as CustomWebSocket;
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

async function handleUserOnline(ws: CustomWebSocket, userId: number) {
  try {
    console.log(`👤 User ${userId} coming online`);

    // Store the WebSocket connection with the userId
    onlineUsers.set(userId, ws);

    // Store userId in WebSocket instance for easy reference
    ws.userId = userId;

    await prisma.student.update({
      where: { id: userId },
      data: { isOnline: true },
    });

    broadcastUserStatus(userId, true);
    console.log("📊 Current online users:", Array.from(onlineUsers.keys()));

    // Send confirmation to the user
    ws.send(
      JSON.stringify({
        type: "connection-success",
        userId: userId,
      })
    );
  } catch (error) {
    console.error("❌ Error in handleUserOnline:", error);
  }
}

async function handleSendMessage(ws: CustomWebSocket, data: any) {
  try {
    const { senderId, receiverId, content } = data;
    console.log(`📨 Processing message from ${senderId} to ${receiverId}`);

    // Verify both users exist
    const [sender, receiver] = await Promise.all([
      prisma.student.findUnique({ where: { id: senderId } }),
      prisma.student.findUnique({ where: { id: receiverId } }),
    ]);

    if (!sender || !receiver) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: !sender ? "Sender not found" : "Receiver not found",
        })
      );
      return;
    }

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
      ws.send(
        JSON.stringify({
          type: "error",
          message: "No active connection found",
        })
      );
      return;
    }

    // Save message and update notification in a transaction
    const [message, notification] = await prisma.$transaction(
      async (prisma) => {
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

        // Update or create notification
        const notification = await prisma.notification.upsert({
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
      }
    );

    // Prepare message payload
    const messagePayload = JSON.stringify({
      type: "new-message",
      message: {
        ...message,
        timestamp: new Date().toISOString(),
      },
    });

    // Send to sender (confirmation)
    ws.send(
      JSON.stringify({
        type: "message-sent",
        message: {
          ...message,
          timestamp: new Date().toISOString(),
        },
      })
    );
    console.log(`✅ Message sent confirmation to sender ${senderId}`);

    // Send to receiver if online
    const receiverWs = onlineUsers.get(receiverId);
    if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
      try {
        // Send new message to receiver
        receiverWs.send(messagePayload);
        console.log(`✅ Message delivered to receiver ${receiverId}`);

        // Send notification update
        receiverWs.send(
          JSON.stringify({
            type: "notification-update",
            notification: {
              senderId,
              count: notification.count,
              lastMessage: new Date().toISOString(),
            },
          })
        );
        console.log(`✅ Notification sent to receiver ${receiverId}`);
      } catch (error) {
        console.error(`❌ Error sending to receiver ${receiverId}:`, error);
        onlineUsers.delete(receiverId);
      }
    } else {
      console.log(
        `ℹ️ Receiver ${receiverId} is offline or connection is closed`
      );
    }

    // Log the message delivery status
    console.log(`📊 Message delivery status:
      Sender (${senderId}): ✅ Delivered
      Receiver (${receiverId}): ${receiverWs ? "✅ Delivered" : "❌ Offline"}
    `);
  } catch (error) {
    console.error("❌ Error in handleSendMessage:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to send message",
      })
    );
  }
}

async function handleFetchChatHistory(ws: CustomWebSocket, data: any) {
  try {
    const { userId, otherId } = data;

    const messages = await prisma.message.findMany({
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

    ws.send(
      JSON.stringify({
        type: "chat-history",
        messages,
      })
    );
  } catch (error) {
    console.error("❌ Error fetching chat history:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to fetch chat history",
      })
    );
  }
}

async function handleMarkMessagesRead(data: any) {
  try {
    const { userId, senderId } = data;

    // Update messages and clear notifications in a transaction
    await prisma.$transaction(async (prisma) => {
      // Mark messages as read
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

      // Clear notification for this sender
      await prisma.notification.deleteMany({
        where: {
          studentId: userId,
          senderId: senderId,
        },
      });
    });

    // Notify the reader about cleared notifications
    const readerWs = onlineUsers.get(userId);
    if (readerWs) {
      readerWs.send(
        JSON.stringify({
          type: "notifications-cleared",
          senderId,
        })
      );
    }

    // Notify the sender that messages were read
    const senderWs = onlineUsers.get(senderId);
    if (senderWs) {
      senderWs.send(
        JSON.stringify({
          type: "messages-read",
          by: userId,
        })
      );
    }
  } catch (error) {
    console.error("❌ Error in handleMarkMessagesRead:", error);
  }
}

// Add a new function to get notification counts
async function handleGetNotifications(ws: CustomWebSocket, userId: number) {
  try {
    const notifications = await prisma.notification.findMany({
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

    ws.send(
      JSON.stringify({
        type: "notifications",
        notifications,
      })
    );
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to fetch notifications",
      })
    );
  }
}

function handleUserDisconnect(ws: CustomWebSocket) {
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

function broadcastUserStatus(userId: number, isOnline: boolean) {
  const message = JSON.stringify({
    type: "user-status-changed",
    userId,
    isOnline,
  });

  for (const ws of onlineUsers.values()) {
    ws.send(message);
  }
}

export default initializeSocketServer;
