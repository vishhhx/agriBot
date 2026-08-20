import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { authRouter } from "./routers/auth";
import { robotRouter } from "./routers/robot";

export const app = express();

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/robots", robotRouter);
