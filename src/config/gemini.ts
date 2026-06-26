import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// ─── Client Google AI (serveur Node.js) ──────────────────────────────────────
// Clé à obtenir sur : https://aistudio.google.com/app/apikey
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Modèles disponibles ─────────────────────────────────────────────────────
export const MODEL_FLASH     = 'gemini-3.1-flash-lite';
export const MODEL_IMAGE_GEN = 'gemini-3.1-flash-image';

// ─── Factory : crée un modèle Gemini prêt à l'emploi ────────────────────────
export const getModel = (modelName: string = MODEL_FLASH) =>
  genAI.getGenerativeModel({ model: modelName });

export default genAI;
