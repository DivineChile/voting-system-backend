import express from "express";
import cors from "cors";
import env from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminElectionRoutes from "./routes/adminElectionRoutes.js";
import adminPositionRoutes from "./routes/adminPositionRoutes.js";
import adminCandidateRoutes from "./routes/adminCandidateRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import adminSetupRoutes from "./routes/adminSetupRoutes.js";
import studentVotingRoutes from "./routes/studentVotingRoutes.js";
import resultsRoutes from "./routes/resultsRoutes.js";
import auditLogRoutes from "./routes/auditLogRoutes.js";
import officerRoutes from "./routes/officerRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/admin", adminElectionRoutes);
app.use("/api/admin", adminPositionRoutes);
app.use("/api/admin", adminCandidateRoutes);
app.use("/api/admin", adminSetupRoutes);
app.use("/api/admin", auditLogRoutes);
app.use("/api/officer", officerRoutes);
app.use("/api/student", studentVotingRoutes);
app.use("/api", resultsRoutes);
app.use("/api/ai", aiRoutes);

export default app;
