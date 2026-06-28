import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// ─── Client Google AI (serveur Node.js) ──────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Modèles disponibles ─────────────────────────────────────────────────────
export const MODEL_FLASH     = 'gemini-3.5-flash';
export const MODEL_IMAGE_GEN = 'gemini-3.5-flash';

// Modèles de repli en cas de 503 (surcharge du modèle principal)
export const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite'
];

// ─── Factory : crée un modèle Gemini prêt à l'emploi ────────────────────────
export const getModel = (modelName: string = MODEL_FLASH) =>
  genAI.getGenerativeModel({ model: modelName });

export default genAI;
