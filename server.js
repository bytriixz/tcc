import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("Por favor, defina a variável de ambiente GOOGLE_API_KEY");
}

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Função para gerar resposta educativa
async function getTeachingResponse(question, revealAnswer = false) {
  // Se o usuário não quiser a resposta final, instruímos o modelo a dar apenas dicas
  const prompt = revealAnswer
    ? `Você é um professor virtual. Explique passo a passo e forneça a resposta final para o aluno. Pergunta: ${question}`
    : `Você é um professor virtual. Ensine o aluno passo a passo, fornecendo dicas e perguntas de reflexão. **Não revele a resposta final.** Pergunta: ${question}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// Endpoint da API para o chatbot
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  const reveal = req.body.revealAnswer || false; // Usuário pode pedir a resposta final

  if (!userMessage) {
    return res.status(400).json({ error: 'Mensagem não fornecida.' });
  }

  try {
    const botText = await getTeachingResponse(userMessage, reveal);
    res.json({ reply: botText });
  } catch (error) {
    console.error("Erro ao chamar a API Gemini:", error);
    res.status(500).json({ error: 'Erro ao processar sua mensagem. Tente novamente.' });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
