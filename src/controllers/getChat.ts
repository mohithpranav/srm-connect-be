import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get chat history between two users
const getChat = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, otherId } = req.params;

    const messages = await prisma.message.findMany({
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
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// Get last message between two users
const getLastMessage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, otherId } = req.params;

    const lastMessage = await prisma.message.findFirst({
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

    const unreadCount = await prisma.message.count({
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
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch last message" });
  }
};

// Get all chats for a user with last messages
const getUserChats = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;

    // Get all connections for the user
    const connections = await prisma.connection.findMany({
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
    const chatsWithMessages = await Promise.all(
      connections.map(async (conn) => {
        const otherId =
          conn.requesterId === parseInt(userId)
            ? conn.recipientId
            : conn.requesterId;

        const lastMessage = await prisma.message.findFirst({
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

        const unreadCount = await prisma.message.count({
          where: {
            senderId: otherId,
            receiverId: parseInt(userId),
            isRead: false,
          },
        });

        const otherUser =
          conn.requesterId === parseInt(userId)
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
      })
    );

    // Sort by last message time
    const sortedChats = chatsWithMessages.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return (
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
      );
    });

    res.json({
      chats: sortedChats,
    });
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({ error: "Failed to fetch user chats" });
  }
};

export { getChat, getLastMessage, getUserChats };
