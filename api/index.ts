import express from "express";
import eventStreamRouter from "../server/routes/eventStream";
import candidatesRouter from "../server/routes/candidates";

const app = express();

app.use(express.json());

// API routes
app.use("/api/events", eventStreamRouter);
app.use("/api/candidates", candidatesRouter);

// Standard API root message
app.get("/api", (req, res) => {
  res.json({ message: "OK Democrats API is running" });
});

export default app;
