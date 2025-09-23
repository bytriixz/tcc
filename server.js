import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração __dirname em ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error("Por favor, defina a variável de ambiente GOOGLE_API_KEY no .env");
}

const ai = new GoogleGenerativeAI(apiKey);
const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });

const app = express();
const PORT = process.env.PORT || 3000;

// ============================
// ROTA PRINCIPAL
// ============================
// Redireciona a raiz do site (/) para a página de login.
// Esta rota precisa vir ANTES de `express.static` para ter prioridade sobre
// um possível arquivo `index.html` na pasta `static`.
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ============================
// MIDDLEWARES
// ============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // aceita <form>
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "static"))); // serve login.html, cadastro.html etc.
app.use(
  session({
    secret: "segredo123",
    resave: false,
    saveUninitialized: true,
  })
);

// ============================
// CONFIG BANCO (SQLite)
// ============================
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "usuarios.db",
});

// Modelo Usuario
const Usuario = sequelize.define("Usuario", {
  fullname: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

// Cria tabela se não existir
await sequelize.sync();

// ============================
// ROTAS DE AUTENTICAÇÃO
// ============================

// Cadastro
app.post("/cadusuar", async (req, res) => {
  // A validação de 'confirm_password' já é feita no frontend (cadastro.html)
  // O frontend não envia 'confirm_password', então removemos a checagem aqui.
  const { fullname, email, username, password } = req.body;

  try {
    const senhaCriptografada = await bcrypt.hash(password, 10);
    const novoUsuario = await Usuario.create({
      fullname,
      email,
      username,
      password: senhaCriptografada,
    });

    // Responde com JSON para a requisição fetch do frontend
    res.status(201).json({ message: "Conta criada com sucesso!" });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      // Retorna um erro em JSON que o frontend pode exibir
      return res.status(400).json({ error: "Usuário ou email já cadastrado." });
    }
    console.error("Erro ao cadastrar:", error);
    res.status(500).json({ error: "Erro interno ao cadastrar usuário." });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ where: { username } });

    if (!usuario) {
      // Usamos 401 (Não autorizado) e retornamos JSON
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const senhaValida = await bcrypt.compare(password, usuario.password);
    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    req.session.user = usuario;

    // Responde com JSON para a requisição fetch do frontend
    res.status(200).json({ message: "Login realizado com sucesso!" });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: "Erro interno ao realizar login." });
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// (Opcional) Rota para listar usuários
app.get("/usuarios", async (req, res) => {
  const lista = await Usuario.findAll({ attributes: ["id", "fullname", "email", "username"] });
  res.json(lista);
});

// ============================
// CHATBOT GEMINI
// ============================
async function getTeachingResponse(question, revealAnswer = false) {
  const greetings = ["oi", "olá", "ola", "hey", "bom dia", "boa tarde", "boa noite"];
  const isGreeting = greetings.some(greet => question.toLowerCase().includes(greet));
  

  let prompt;
  if (isGreeting) {
    prompt = `Você é um chatbot educacional amigável.
O usuário enviou uma saudação: "${question}".
Responda curto e acolhedor.`;
  } else {
    prompt = revealAnswer
      ? `Explique passo a passo e dê a resposta final em Markdown: ${question}`
      : `Explique passo a passo em Markdown sem revelar a resposta final. Pergunta: ${question}`;
  }

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const reveal = req.body.revealAnswer || false;

  if (!userMessage) {
    return res.status(400).json({ error: "Mensagem não fornecida." });
  }

  try {
    const botText = await getTeachingResponse(userMessage, reveal);
    res.json({ reply: botText });
  } catch (error) {
    console.error("Erro ao chamar a API Gemini:", error);
    res.status(500).json({ error: "Erro ao processar mensagem." });
  }
});

// ============================
// START SERVER
// ============================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
