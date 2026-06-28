import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getModel, MODEL_FLASH, FALLBACK_MODELS } from '../config/gemini';

// ─── Helper : extraire le JSON d'une réponse Gemini ──────────────────────────
function parseJsonResponse(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse IA invalide : aucun JSON trouvé');
  return JSON.parse(match[0]);
}

// ─── Helper : exécuter avec repli automatique ───────────────────────────────
async function executeWithFallback(promptData: any): Promise<any> {
  const modelsToTry = [MODEL_FLASH, ...FALLBACK_MODELS];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Tentative avec le modèle : ${modelName}`);
      const model = getModel(modelName);
      const result = await model.generateContent(promptData);
      return result;
    } catch (error: any) {
      console.warn(`[Gemini] Échec avec ${modelName}:`, error.message);
      lastError = error;
      // Si l'erreur n'est pas un 503 ou une surcharge, on peut éventuellement décider de ne pas réessayer.
      // Mais dans le doute, on essaie le prochain modèle.
    }
  }
  throw lastError;
}

// ─── 1. CONTEXT READER ────────────────────────────────────────────────────────
// POST /api/meme/from-text
// Body: { text: string, style?: string }
export const generateFromText = async (req: Request, res: Response) => {
  const { text, style = 'humour général' } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: 'Le champ "text" est requis.' });
  }

  try {
    let styleInstruction = "Humour general, relatable et leger.";
    switch (style.toLowerCase()) {
      case 'sarcastique':
        styleInstruction = "Humour sarcastique, ironique et cynique. Moque-toi gentiment de la situation de maniere pince-sans-rire.";
        break;
      case 'absurde':
        styleInstruction = "Humour absurde, surrealiste, imprevisible et totalement decale.";
        break;
      case 'sombre':
        styleInstruction = "Humour noir, subtil et grincant, jouant sur l'ironie tragique ou desesperee de la situation.";
        break;
      case 'geek':
        styleInstruction = "Humour oriente technologie, developpement logiciel, bugs, culture web et references informatiques.";
        break;
    }

    const prompt = `
Tu es un expert en mèmes internet et humour décalé.
Analyse ce message ou extrait de conversation :
"""
${text}
"""

Génère un mème adapté au contexte. Réponds UNIQUEMENT en JSON valide :
{
  "top_text": "texte du haut du mème (max 8 mots)",
  "bottom_text": "texte du bas du mème (max 8 mots)",
  "template_suggestion": "nom d'un template de mème connu (ex: Drake, Distracted Boyfriend, This is Fine...)",
  "explanation": "explication courte en français de pourquoi c'est drôle",
  "image_prompt": "description en anglais pour générer l'image du mème"
}
Directives de style d'humour : ${styleInstruction}
`;

    const result = await executeWithFallback(prompt);
    const response = result.response;
    const responseText = response.text();
    const memeData = parseJsonResponse(responseText);

    return res.json({ success: true, meme: memeData });
  } catch (err: any) {
    console.error('[from-text] Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur lors de la génération du mème.', details: err.message });
  }
};

// ─── 2. VOICE-TO-MEME ─────────────────────────────────────────────────────────
// POST /api/meme/from-audio  (fichier audio uploadé via multer)
export const generateFromAudio = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier audio fourni.' });
  }

  const audioPath = req.file.path;

  try {
    // Lire l'audio en base64
    const audioBase64 = fs.readFileSync(audioPath).toString('base64');

    const result = await executeWithFallback([
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: audioBase64,
        },
      },
      {
        text: `Tu es un expert en humour et mèmes.
Écoute cet audio et effectue les tâches suivantes :
1. Transcris exactement ce qui est dit.
2. Analyse l'émotion ou la situation.
3. Génère un mème drôle basé sur le contenu.

Réponds UNIQUEMENT en JSON valide :
{
  "transcription": "texte exact de l'audio",
  "emotion_detected": "émotion principale détectée",
  "top_text": "texte du haut du mème",
  "bottom_text": "texte du bas du mème",
  "template_suggestion": "template de mème suggéré",
  "explanation": "pourquoi c'est drôle"
}`,
      },
    ]);

    const memeData = parseJsonResponse(result.response.text());
    return res.json({ success: true, meme: memeData });
  } catch (err: any) {
    console.error('[from-audio] Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur lors du traitement audio.', details: err.message });
  } finally {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
};

// ─── 3. STATUS REMIXER ────────────────────────────────────────────────────────
// POST /api/meme/from-image  (image uploadée via multer)
export const generateFromImage = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucune image fournie.' });
  }

  const imagePath = req.file.path;
  const { context = '' } = req.body;

  try {
    const imageBase64 = fs.readFileSync(imagePath).toString('base64');

    const result = await executeWithFallback([
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imageBase64,
        },
      },
      {
        text: `Tu es un expert en mèmes visuels.
Analyse cette image${context ? ` dans le contexte : "${context}"` : ''}.
Génère un texte de mème drôle et pertinent.

Réponds UNIQUEMENT en JSON valide :
{
  "image_description": "description courte de ce que tu vois",
  "top_text": "texte du haut du mème (max 10 mots)",
  "bottom_text": "texte du bas du mème (max 10 mots)",
  "caption": "légende alternative pour les réseaux sociaux",
  "humor_level": "léger | modéré | absurde",
  "explanation": "pourquoi c'est drôle"
}`,
      },
    ]);

    const memeData = parseJsonResponse(result.response.text());
    const imageUrl = `/uploads/${req.file.filename}`;

    return res.json({ success: true, meme: memeData, imageUrl });
  } catch (err: any) {
    console.error('[from-image] Erreur:', err.message);
    return res.status(500).json({ error: "Erreur lors de l'analyse de l'image.", details: err.message });
  }
};

// ─── 4. GENERATE IMAGE [POLLINATIONS.AI] ───────────────────────────────────────
// POST /api/meme/generate-image
// Body: { prompt: string, top_text?: string, bottom_text?: string }
export const generateMemeImage = async (req: Request, res: Response) => {
  const { prompt, top_text = '', bottom_text = '' } = req.body;

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Le champ "prompt" est requis.' });
  }

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const filename  = `generated-${Date.now()}.png`;

  try {
    const axios = require('axios');
    const https = require('https');
    
    const pollinationPrompt = `${prompt}, high quality realistic meme template, stock photo style, clean composition`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(pollinationPrompt)}?width=512&height=512&nologo=true`;

    console.log('[generate-image] Génération via Pollinations.ai...');

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxRedirects: 5,
      httpsAgent: new https.Agent({ family: 4 }),
    });

    const imageBuffer = Buffer.from(response.data);

    // Écriture locale du fichier image dans uploads/
    fs.writeFileSync(`${uploadDir}/${filename}`, imageBuffer);

    return res.json({
      success: true,
      imageUrl: `/uploads/${filename}`,
      description: 'Généré via Pollinations.ai',
    });
  } catch (err: any) {
    console.error('[generate-image] Pollinations.ai a échoué:', err);
    return res.status(500).json({
      error: "Erreur lors de la génération d'image. Réessayez dans quelques instants.",
      details: err.message || String(err),
    });
  }
};

// ─── 4.5. APPLY FILTER [SHARP] ───────────────────────────────────────────────
// POST /api/meme/apply-filter
// Body: { imageUrl: string, filter: string }
export const applyFilter = async (req: Request, res: Response) => {
  const { imageUrl, filter } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Le champ "imageUrl" est requis.' });
  }

  try {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const filename = path.basename(imageUrl);
    const inputPath = path.resolve(uploadDir, filename);

    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: `Image introuvable sur le serveur : ${filename}` });
    }

    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    // On nettoie le nom de base s'il contenait déjà un filtre pour ne pas accumuler dans le nom
    const cleanBase = base.split('-filter-')[0];
    const outputFilename = `${cleanBase}-filter-${filter}-${Date.now()}${ext}`;
    const outputPath = path.resolve(uploadDir, outputFilename);

    let transformer = sharp(inputPath);

    switch (filter.toLowerCase()) {
      case 'grayscale':
        transformer = transformer.grayscale();
        break;
      case 'sepia':
        transformer = transformer.recomb([
          [0.3588, 0.7044, 0.1368],
          [0.2990, 0.5870, 0.1140],
          [0.2392, 0.4696, 0.0912]
        ]);
        break;
      case 'invert':
        transformer = transformer.negate();
        break;
      case 'blur':
        transformer = transformer.blur(6);
        break;
      case 'vibrant':
        transformer = transformer.modulate({ saturation: 1.8, brightness: 1.1 });
        break;
      case 'cool':
        transformer = transformer.recomb([
          [0.8, 0.0, 0.0],
          [0.0, 0.9, 0.0],
          [0.0, 0.0, 1.3]
        ]);
        break;
      case 'normal':
      default:
        // Si c'est normal, on retourne l'image d'origine
        return res.json({
          success: true,
          imageUrl: `/uploads/${filename}`
        });
    }

    await transformer.toFile(outputPath);

    return res.json({
      success: true,
      imageUrl: `/uploads/${outputFilename}`
    });
  } catch (err: any) {
    console.error('[applyFilter] Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur lors de l\'application du filtre.', details: err.message });
  }
};

// ─── 5. SAVE & FEED PERSISTENCE [JSON DB] ─────────────────────────────────────
const MEMES_DB_PATH = path.resolve(process.env.UPLOAD_DIR || './uploads', 'memes_db.json');

// Utilitaire pour lire la DB JSON
function readMemesDb(): any[] {
  try {
    if (!fs.existsSync(MEMES_DB_PATH)) {
      return [];
    }
    const data = fs.readFileSync(MEMES_DB_PATH, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Erreur lors de la lecture de memes_db.json:', error);
    return [];
  }
}

// Utilitaire pour écrire dans la DB JSON
function writeMemesDb(memes: any[]): void {
  try {
    fs.writeFileSync(MEMES_DB_PATH, JSON.stringify(memes, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erreur lors de l\'écriture dans memes_db.json:', error);
  }
}

// POST /api/meme/save
export const saveMeme = async (req: Request, res: Response) => {
  const { author = 'MemeMaker User', top_text = '', bottom_text = '', imageUrl = '', explanation = '', template_suggestion = '', style = '' } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Le champ "imageUrl" est requis pour sauvegarder.' });
  }

  try {
    const memes = readMemesDb();
    const newMeme = {
      id: Date.now().toString(),
      author,
      top_text,
      bottom_text,
      imageUrl,
      explanation,
      template_suggestion,
      style,
      createdAt: new Date().toISOString(),
    };
    memes.push(newMeme);
    writeMemesDb(memes);

    return res.json({ success: true, meme: newMeme });
  } catch (err: any) {
    console.error('[saveMeme] Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur lors de la sauvegarde du mème.', details: err.message });
  }
};

// GET /api/meme/feed
export const getMemeFeed = async (_req: Request, res: Response) => {
  try {
    const memes = readMemesDb();
    // Trier du plus récent au plus ancien
    const sortedMemes = memes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json({ success: true, memes: sortedMemes });
  } catch (err: any) {
    console.error('[getMemeFeed] Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur lors de la récupération du flux.', details: err.message });
  }
};

// POST /api/meme/make-sticker
export const makeSticker = async (req: Request, res: Response) => {
  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ success: false, error: 'imageUrl manquante' });
  }

  try {
    const axios = require('axios');
    const uploadDir = process.env.UPLOAD_DIR || './uploads';

    // 1. Récupérer le buffer de l'image
    let inputBuffer: Buffer;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      inputBuffer = Buffer.from(response.data);
    } else {
      let cleanPath = imageUrl;
      if (cleanPath.startsWith('/uploads')) {
        cleanPath = path.join(uploadDir, cleanPath.replace('/uploads', ''));
      } else if (cleanPath.startsWith('uploads')) {
        cleanPath = path.join(uploadDir, cleanPath.replace('uploads', ''));
      }
      inputBuffer = fs.readFileSync(cleanPath);
    }

    // 2. Charger l'image avec sharp, assurer le canal alpha (RGBA)
    const image = sharp(inputBuffer);
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    // Index dans le tableau 1D de pixels
    const getIndex = (x: number, y: number) => y * width + x;

    const enqueue = (x: number, y: number) => {
      const idx = getIndex(x, y);
      if (!visited[idx]) {
        visited[idx] = 1;
        queue.push(x, y);
      }
    };

    // Ajouter les pixels de bordure à la file d'attente de départ
    for (let x = 0; x < width; x++) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    // Lire la couleur de fond cible au coin supérieur gauche
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    const tolerance = 25; // Sensibilité du détourage

    // Remplissage par diffusion (Flood Fill)
    let head = 0;
    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];

      const idx = getIndex(x, y);
      const pixelStart = idx * 4;
      const r = data[pixelStart];
      const g = data[pixelStart + 1];
      const b = data[pixelStart + 2];

      // Vérifier si la couleur du pixel est proche de la couleur du fond
      const diffR = Math.abs(r - bgR);
      const diffG = Math.abs(g - bgG);
      const diffB = Math.abs(b - bgB);

      if (diffR <= tolerance && diffG <= tolerance && diffB <= tolerance) {
        data[pixelStart + 3] = 0; // Rendre transparent

        // Propager aux 4 voisins
        if (x > 0) enqueue(x - 1, y);
        if (x < width - 1) enqueue(x + 1, y);
        if (y > 0) enqueue(x, y - 1);
        if (y < height - 1) enqueue(x, y + 1);
      }
    }

    // 3. Exporter l'image détourée sous forme de fichier WebP (.webp)
    const filename = `sticker-${Date.now()}.webp`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(data, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .webp({ quality: 90 })
      .toFile(outputPath);

    return res.json({
      success: true,
      stickerUrl: `/uploads/${filename}`,
    });
  } catch (err: any) {
    console.error('[makeSticker] Erreur:', err);
    return res.status(500).json({
      error: 'Erreur lors de la création du sticker.',
      details: err.message || String(err),
    });
  }
};

