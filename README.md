# MemeMaker Backend

Ce dépôt héberge l'API Backend pour le projet **MemeMaker** (Application Mobile React Native de génération de mèmes par IA).
L'API a pour rôle de communiquer de façon sécurisée avec l'API **Google Gemini (Flash)** pour l'analyse de textes/audios/images, et **Pollinations.ai** pour la génération d'images.

## 🚀 Fonctionnalités Principales

- **Context Reader (Texte)** : Analyse un texte brut pour en extraire l'humour, le sarcasme ou l'absurdité, et génère un texte de mème adapté.
- **Voice-to-Meme (Audio)** : Reçoit un fichier audio, le transmet à Gemini pour transcription et analyse d'émotion, puis suggère un mème !
- **Status Remixer (Image)** : Analyse le contexte visuel d'une photo uploadée et y appose des textes drôles.
- **Génération d'Image IA** : Génère une image libre de droits collant au contexte humoristique demandé via *Pollinations.ai*.
- **Sauvegarde & Flux** : Sauvegarde locale basique des mèmes générés et exposition d'un flux chronologique pour l'historique de l'utilisateur.

---

## 🛠️ Stack Technique

- **Node.js / Express** : Serveur HTTP.
- **TypeScript** : Pour un typage strict et une base de code robuste.
- **Google Gen AI SDK (`@google/genai`)** : Interfaçage avec les modèles Gemini 2.5 Flash / Pro pour l'analyse multimodale (Texte, Audio, Image).
- **Multer** : Gestion des uploads de fichiers multipart/form-data (audio/image).
- **Axios** : Requêtes HTTP sortantes (vers Pollinations.ai).

---

## ⚙️ Prérequis et Installation

1. **Cloner le projet**
   ```bash
   git clone https://github.com/Junior-NB/MemeMakerBackend.git
   cd MemeMakerBackend
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Variables d'environnement**
   Copiez le fichier d'exemple et renseignez votre clé d'API Gemini.
   ```bash
   cp .env.example .env
   ```
   *Le fichier `.env` doit au minimum contenir votre clé `GEMINI_API_KEY`.*

4. **Lancer le serveur en mode développement**
   ```bash
   npm run dev
   ```
   Le serveur sera accessible sur `http://localhost:3000`.

---

## 🔗 Documentation de l'API

L'URL de base est `/api/meme`.

| Endpoint | Méthode | Description | Payload / Form Data |
| :--- | :---: | :--- | :--- |
| `/from-text` | `POST` | Génère un mème à partir de texte | JSON: `{ "text": "...", "style": "..." }` |
| `/from-audio` | `POST` | Génère un mème à partir de la voix | Form-Data: `audio` (Fichier .mp4/.m4a) |
| `/from-image` | `POST` | Analyse une photo pour un mème | Form-Data: `image` (Fichier image) |
| `/generate-image` | `POST` | Génère l'image du mème | JSON: `{ "prompt": "..." }` |
| `/save` | `POST` | Sauvegarde un mème généré | JSON complet du mème généré |
| `/feed` | `GET` | Récupère l'historique des mèmes | - |

---

## 📱 Lien avec l'Application Mobile

Pour faire fonctionner l'Application Mobile (React Native) en environnement de développement local avec cet API, n'oubliez pas d'utiliser **ADB Reverse Proxy** afin que l'émulateur puisse atteindre le `localhost:3000` de votre machine :

```bash
adb reverse tcp:3000 tcp:3000
```
