import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({ success: true, service: "admin", status: "healthy" });
});

app.use(express.static(distDir));

app.get("*", (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
    console.log(`Admin app is running on port ${PORT}`);
});
