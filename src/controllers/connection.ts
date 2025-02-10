import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

// ✅ Send Connection Request
const sendConnectionRequest = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { requesterId, recipientId } = req.body;

  // ✅ Validate input IDs
  if (
    !requesterId ||
    !recipientId ||
    isNaN(requesterId) ||
    isNaN(recipientId)
  ) {
    return res
      .status(400)
      .json({ message: "Invalid requester or recipient ID" });
  }

  // ✅ Prevent self-connection
  if (requesterId === recipientId) {
    return res.status(400).json({ message: "Cannot connect with yourself" });
  }

  try {
    // ✅ Check if both students exist
    const requester = await prisma.student.findUnique({
      where: { id: requesterId },
    });
    const recipient = await prisma.student.findUnique({
      where: { id: recipientId },
    });

    if (!requester || !recipient) {
      return res
        .status(404)
        .json({ message: "One or both students not found" });
    }

    // ✅ Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });

    if (existingConnection) {
      return res.status(400).json({ message: "Connection already exists" });
    }

    // ✅ Create a new connection request
    const connection = await prisma.connection.create({
      data: { requesterId, recipientId, status: "PENDING" },
    });

    return res.status(201).json(connection);
  } catch (error) {
    return res.status(500).json({ error: "Error sending connection request" });
  }
};

// ✅ Accept or Reject Connection Request
const updateConnectionRequest = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { connectionId, status } = req.body;

  if (!connectionId || isNaN(connectionId)) {
    return res.status(400).json({ message: "Invalid connection ID" });
  }

  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    // ✅ Check if connection exists
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      return res.status(404).json({ message: "Connection request not found" });
    }

    // ✅ Update connection status
    const updatedConnection = await prisma.connection.update({
      where: { id: connectionId },
      data: { status, acceptedAt: status === "ACCEPTED" ? new Date() : null },
    });

    return res.status(200).json(updatedConnection);
  } catch (error) {
    return res.status(500).json({ error: "Error updating connection" });
  }
};

// ✅ Get All Connections for a User
const getConnections = async (req: Request, res: Response): Promise<any> => {
  const userId = parseInt(req.params.userId);

  if (!userId || isNaN(userId)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // ✅ Get accepted connections for the user
    const connections = await prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { recipientId: userId }],
        status: "ACCEPTED",
      },
    });

    return res.status(200).json(connections);
  } catch (error) {
    return res.status(500).json({ error: "Error fetching connections" });
  }
};

export { sendConnectionRequest, updateConnectionRequest, getConnections };
