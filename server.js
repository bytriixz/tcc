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
// MIDDLEWARES
// ============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // aceita <form>
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
  quizCompleted: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  score: { type: DataTypes.INTEGER, allowNull: true },
});

// Cria tabela se não existir
// O { alter: true } garante que a tabela no banco de dados seja atualizada
// para corresponder ao modelo, adicionando a coluna `quizCompleted` se ela
// não existir, sem apagar os dados existentes.
await sequelize.sync({ alter: true });

// ============================
// ROTAS
// ============================

// ROTA PRINCIPAL: Redireciona para o login.
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Rota do Chatbot: decide qual página mostrar (com ou sem questionário)
app.get('/index.html', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }

  try {
    // Busca o usuário no banco para ter a informação mais recente
    const usuario = await Usuario.findByPk(req.session.user.id);
    if (usuario && !usuario.quizCompleted) {
      // Se o quiz não foi completo, mostra a página com o questionário
      res.sendFile(path.join(__dirname, 'public', 'questpontucao.html'));
    } else {
      // Se já completou, mostra a página de chat normal
      res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    }
  } catch (error) {
    console.error("Erro ao verificar status do quiz:", error);
    res.status(500).send("Erro ao carregar a página do chat.");
  }
});

app.get('/aprendizado.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'static', 'aprendizado.html'));
});

app.get('/perfil.html', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  res.sendFile(path.join(__dirname, 'static', 'perfil.html'));
});

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

    // Armazena um objeto simples na sessão para evitar erros de serialização
    // e para não expor dados sensíveis como a senha.
    req.session.user = {
      id: usuario.id,
      username: usuario.username,
      fullname: usuario.fullname,
      email: usuario.email,
      quizCompleted: usuario.quizCompleted
    };
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

// Rota para marcar o questionário como concluído e salvar a pontuação
app.post('/quiz/complete', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  const { score } = req.body;

  if (score === undefined) {
    return res.status(400).json({ error: 'Pontuação não fornecida.' });
  }

  try {
    const usuario = await Usuario.findByPk(req.session.user.id);
    if (usuario) {
      usuario.quizCompleted = true;
      usuario.score = score; // Salva a pontuação
      await usuario.save();

      // Atualiza a sessão com os novos dados
      req.session.user.quizCompleted = true;
      req.session.user.score = score;

      res.status(200).json({ message: 'Quiz finalizado e pontuação salva com sucesso.' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao salvar pontuação do quiz:', error);
    res.status(500).json({ error: 'Erro interno ao atualizar status do quiz.' });
  }
});

// (Opcional) Rota para listar usuários
app.get("/usuarios", async (req, res) => {
  const lista = await Usuario.findAll({ attributes: ["id", "fullname", "email", "username"] });
  res.json(lista);
});

// Rota para obter dados do usuário logado
app.get('/api/me', async (req, res) => {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }
  try {
    const usuario = await Usuario.findByPk(req.session.user.id);
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
  }
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
// SERVIR ARQUIVOS ESTÁTICOS (deve vir depois das rotas)
// ============================
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "static")));

// ============================
// START SERVER
// ============================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
