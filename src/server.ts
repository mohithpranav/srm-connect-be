import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import router from "./routes/authRoutes";
import initializeSocketServer from "./controllers/socketServer";

dotenv.config();
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use("/api", router);

// Initialize WebSocket Server
initializeSocketServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
