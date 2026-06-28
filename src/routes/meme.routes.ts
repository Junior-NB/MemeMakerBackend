import { Router } from 'express';
import { upload } from '../config/multer';
import {
  generateFromText,
  generateFromAudio,
  generateFromImage,
  generateMemeImage,
  saveMeme,
  getMemeFeed,
  applyFilter,
} from '../controllers/meme.controller';

const router = Router();

// POST /api/meme/from-text     → Context Reader
router.post('/from-text', generateFromText);

// POST /api/meme/from-audio    → Voice-to-Meme
router.post('/from-audio', upload.single('audio'), generateFromAudio);

// POST /api/meme/from-image    → Status Remixer
router.post('/from-image', upload.single('image'), generateFromImage);

// POST /api/meme/generate-image → [BONUS] Génération d'image IA (remplace Imagen)
router.post('/generate-image', generateMemeImage);

// POST /api/meme/apply-filter    → Appliquer un filtre d'image (Noir & Blanc, Sépia...)
router.post('/apply-filter', applyFilter);

// POST /api/meme/save           → Sauvegarde d'un mème
router.post('/save', saveMeme);

// GET /api/meme/feed            → Récupération du flux
router.get('/feed', getMemeFeed);

export default router;
