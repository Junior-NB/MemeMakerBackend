import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

// Fix Node.js ETIMEDOUT issue on IPv6-enabled networks without active routing
dns.setDefaultResultOrder('ipv4first');

import memeRoutes from './routes/meme.routes';
import uploadRoutes from './routes/upload.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Créer le dossier uploads s'il n'existe pas
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers uploadés statiquement
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Routes
app.use('/api/meme', memeRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'MemeMaker Backend is running 🚀' });
});

app.listen(PORT, () => {
  console.log(`🚀 MemeMaker Backend running on http://localhost:${PORT}`);
});

export default app;
