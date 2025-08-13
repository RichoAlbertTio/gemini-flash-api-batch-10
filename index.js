const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();
const app = express();
app.use(express.json());

const getAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = getAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gemini API server is running on http://localhost:${PORT}`);
});

app.post('/generate-text', async (req, res) => {
  const { prompt } = req.body;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function imageToGeneratePart(imagePath) {
  const image = fs.readFileSync(imagePath);
  const imageBuffer = Buffer.from(image).toString('base64');
  return `data:image/jpeg;base64,${imageBuffer}`;
}

app.post('/generate-form-image', upload.single('image'), async (req, res) => {
  const prompt = req.body.prompt || 'Describe the image';
  const image = imageToGeneratePart(req.file.path);

  try {
    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    const unlinkAsync = promisify(fs.unlink);
    await unlinkAsync(req.file.path);
  }
});



app.post('/generate-from-document', upload.single('document'), async (req, res) => {
  const filePath = req.file.path;
  const buffer = fs.readFileSync(filePath);
  const base64Data = buffer.toString('base64');
  const mimeType = req.file.mimetype;

  try {
    const documentPart = {
      inlineData: { data: base64Data, mimeType: mimeType }
    };
    const result = await model.generateContent(['Analyze this document', documentPart]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error });
  } finally {
   fs.unlinkSync(filePath);
  }
});



app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
  const audioBuffer = fs.readFileSync(req.file.path);
  const base64Audio = audioBuffer.toString('base64');

  const audioPart = {
    inlineData: {
      data: base64Audio,
      mimeType: req.file.mimetype
    }
  };

  try {
    const result = await model.generateContent([
      'Transcribe or analyze the following audio:', 
      audioPart
    ]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlinkSync(req.file.path);
  }
});
