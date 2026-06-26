import { Router, Request, Response } from 'express';
import { upload } from '../config/multer';

const router = Router();

// POST /api/upload/file  → Upload générique (pour tests)
router.post('/file', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }
  return res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
    },
  });
});

export default router;
