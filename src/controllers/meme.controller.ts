import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getModel, MODEL_FLASH, MODEL_IMAGE_GEN } from '../config/gemini';

// ─── Helper : extraire le JSON d'une réponse Gemini ──────────────────────────
function parseJsonResponse(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Réponse IA invalide : aucun JSON trouvé');
  return JSON.parse(match[0]);
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
    const model = getModel(MODEL_FLASH);

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

    const result = await model.generateContent(prompt);
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
    const model = getModel(MODEL_FLASH);

    // Lire l'audio en base64
    const audioBase64 = fs.readFileSync(audioPath).toString('base64');

    const result = await model.generateContent([
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
    const model = getModel(MODEL_FLASH);

    const imageBase64 = fs.readFileSync(imagePath).toString('base64');

    const result = await model.generateContent([
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

// ─── 4. GENERATE IMAGE [BONUS] ────────────────────────────────────────────────
// POST /api/meme/generate-image
// Body: { prompt: string, top_text?: string, bottom_text?: string }
export const generateMemeImage = async (req: Request, res: Response) => {
  const { prompt, top_text = '', bottom_text = '' } = req.body;

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Le champ "prompt" est requis.' });
  }

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const filename  = `generated-${Date.now()}.png`;
  let imageBuffer: Buffer;
  let description = '';

  try {
    // 1. Essai de génération d'image avec le modèle multimodal Gemini
    const model = getModel(MODEL_IMAGE_GEN);

    const imagePrompt = [
      `Create a funny meme image: ${prompt}.`,
      top_text    ? `Top text: "${top_text}".`    : '',
      bottom_text ? `Bottom text: "${bottom_text}".` : '',
      'Style: internet meme, humorous, expressive.',
    ].filter(Boolean).join(' ');

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } as any,
    });

    const parts = result.response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    const textPart  = parts.find((p: any) => p.text);

    if (!imagePart?.inlineData) {
      throw new Error('Aucune image générée par le modèle.');
    }

    imageBuffer = Buffer.from(imagePart.inlineData.data as string, 'base64');
    description = textPart?.text || '';
  } catch (geminiErr: any) {
    console.log('[generate-image] Gemini Image Gen a échoué (facturation/limites). Repli sur Pollinations.ai...', geminiErr.message);

    try {
      // 2. Repli de secours : Pollinations.ai (100% gratuit, sans clé API, rapide)
      const pollinationPrompt = `${prompt}. ${top_text ? `text: "${top_text}"` : ''} ${bottom_text ? `text: "${bottom_text}"` : ''}, funny internet meme, clean high quality cartoon drawing style`;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(pollinationPrompt)}?width=512&height=512&nologo=true`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Pollinations.ai a retourné le statut ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      description = 'Généré via Pollinations.ai (Secours)';
    } catch (pollinationErr: any) {
      console.error('[generate-image] Le service de secours Pollinations.ai a également échoué:', pollinationErr.message);
      
      // Si les deux échouent, renvoyer l'erreur de base
      let userFriendlyError = "Erreur lors de la génération d'image.";
      if (geminiErr.message?.includes('paid plans') || geminiErr.message?.includes('paid plan')) {
        userFriendlyError = "La génération d'images par l'IA (Imagen 3) nécessite un plan payant dans Google AI Studio et le service de secours libre a échoué.";
      }
      return res.status(400).json({ error: userFriendlyError, details: geminiErr.message });
    }
  }

  // Écriture locale du fichier image dans uploads/
  fs.writeFileSync(`${uploadDir}/${filename}`, imageBuffer);

  return res.json({
    success: true,
    imageUrl: `/uploads/${filename}`,
    description,
  });
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

