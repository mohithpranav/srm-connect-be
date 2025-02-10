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

export { getChat };
