require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

const applicationRoutes = require("./routes/applications.cjs");
const paymentRoutes = require("./routes/payments.cjs");
const webhookRoutes = require("./routes/webhooks.cjs");

const app = express();
const port = process.env.PORT || 3000;
const host = "0.0.0.0";

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname, { index: "index.html" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/applications", applicationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    port,
    uptime: Math.round(process.uptime()),
  });
});

app.listen(port, host, () => {
  console.log(`[startup] Servidor rodando em http://127.0.0.1:${port}`);
});
