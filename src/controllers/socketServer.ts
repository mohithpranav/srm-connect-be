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

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log("📩 Received message:", data);

        switch (data.type) {
          case "user-online":
            ws.userId = data.userId;
            onlineUsers.set(data.userId, ws);
            await handleUserOnline(data.userId);
            ws.send(
              JSON.stringify({
                type: "connection-success",
                userId: data.userId,
              })
            );
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
          JSON.stringify({
            type: "error",
            message: "Failed to process message",
          })
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

async function handleUserOnline(userId: number) {
  try {
    console.log(`👤 User ${userId} coming online`);

    await prisma.student.update({
      where: { id: userId },
      data: { isOnline: true },
    });

    broadcastUserStatus(userId, true);
    console.log("📊 Current online users:", Array.from(onlineUsers.keys()));
  } catch (error) {
    console.error("❌ Error in handleUserOnline:", error);
  }
}

async function handleSendMessage(ws: CustomWebSocket, data: any) {
  try {
    const { senderId, receiverId, content } = data;
    console.log(
      `📨 Processing message from ${senderId} to ${receiverId}:`,
      content
    );

    // First, save message to database
    const message = await prisma.message.create({
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
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: senderId, recipientId: receiverId },
          { requesterId: receiverId, recipientId: senderId },
        ],
      },
    });

    if (connection) {
      await prisma.connection.update({
        where: { id: connection.id },
        data: {
          messages: {
            connect: { id: message.id },
          },
        },
      });
    }

    // Send confirmation to sender
    ws.send(
      JSON.stringify({
        type: "message-sent",
        message,
      })
    );

    // Check if receiver is online
    const receiverWs = onlineUsers.get(receiverId);
    if (receiverWs?.readyState === WebSocket.OPEN) {
      console.log("📤 Sending message to online receiver:", receiverId);
      receiverWs.send(
        JSON.stringify({
          type: "new-message",
          message,
        })
      );
    } else {
      console.log("📥 Receiver is offline, message saved to DB:", receiverId);
      // Optionally increment unread count or create notification
      await prisma.notification.upsert({
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

async function handleMarkMessagesRead(data: {
  userId: number;
  senderId: number;
}) {
  try {
    // Mark messages as read
    await prisma.message.updateMany({
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
    await prisma.notification.update({
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
      const notifications = await getUnreadNotifications(data.userId);
      userWs.send(
        JSON.stringify({
          type: "notifications-update",
          notifications,
        })
      );
    }
  } catch (error) {
    console.error("❌ Error marking messages as read:", error);
  }
}

// Add function to get unread notifications
async function getUnreadNotifications(userId: number) {
  try {
    const notifications = await prisma.notification.findMany({
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
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    return [];
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
