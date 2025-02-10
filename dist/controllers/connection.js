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
exports.getConnections = exports.updateConnectionRequest = exports.sendConnectionRequest = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// ✅ Send Connection Request
const sendConnectionRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { requesterId, recipientId } = req.body;
    // ✅ Validate input IDs
    if (!requesterId ||
        !recipientId ||
        isNaN(requesterId) ||
        isNaN(recipientId)) {
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
        const requester = yield prisma.student.findUnique({
            where: { id: requesterId },
        });
        const recipient = yield prisma.student.findUnique({
            where: { id: recipientId },
        });
        if (!requester || !recipient) {
            return res
                .status(404)
                .json({ message: "One or both students not found" });
        }
        // ✅ Check if connection already exists
        const existingConnection = yield prisma.connection.findFirst({
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
        const connection = yield prisma.connection.create({
            data: { requesterId, recipientId, status: "PENDING" },
        });
        return res.status(201).json(connection);
    }
    catch (error) {
        return res.status(500).json({ error: "Error sending connection request" });
    }
});
exports.sendConnectionRequest = sendConnectionRequest;
// ✅ Accept or Reject Connection Request
const updateConnectionRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { connectionId, status } = req.body;
    if (!connectionId || isNaN(connectionId)) {
        return res.status(400).json({ message: "Invalid connection ID" });
    }
    if (!["ACCEPTED", "REJECTED"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
    }
    try {
        // ✅ Check if connection exists
        const connection = yield prisma.connection.findUnique({
            where: { id: connectionId },
        });
        if (!connection) {
            return res.status(404).json({ message: "Connection request not found" });
        }
        // ✅ Update connection status
        const updatedConnection = yield prisma.connection.update({
            where: { id: connectionId },
            data: { status, acceptedAt: status === "ACCEPTED" ? new Date() : null },
        });
        return res.status(200).json(updatedConnection);
    }
    catch (error) {
        return res.status(500).json({ error: "Error updating connection" });
    }
});
exports.updateConnectionRequest = updateConnectionRequest;
// ✅ Get All Connections for a User
const getConnections = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }
    try {
        // ✅ Get accepted connections for the user
        const connections = yield prisma.connection.findMany({
            where: {
                OR: [{ requesterId: userId }, { recipientId: userId }],
                status: "ACCEPTED",
            },
        });
        return res.status(200).json(connections);
    }
    catch (error) {
        return res.status(500).json({ error: "Error fetching connections" });
    }
});
exports.getConnections = getConnections;
