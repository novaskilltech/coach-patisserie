const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

function normalizeSessionTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .trim();
}

function extractSessionsFromWeekMarkdown(content) {
  const lines = content.split(/\r?\n/);
  const sessions = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/S\s*([1-5])\s*[\u2013\u2014-]\s*(.+)$/);
    if (!match) continue;

    const num = Number(match[1]);
    if (seen.has(num)) continue;
    seen.add(num);

    let title = normalizeSessionTitle(match[2]);
    let next = index + 1;
    while (
      title.length < 58 &&
      next < lines.length &&
      lines[next].trim() &&
      !/Objectifs|But|D[ée]roul[ée]|Points|Ce que|R[oô]le/i.test(lines[next]) &&
      !/S\s*[1-5]\s*[\u2013\u2014-]/.test(lines[next])
    ) {
      title = normalizeSessionTitle(`${title} ${lines[next]}`);
      next += 1;
    }

    sessions.push({ num, label: `S${num}`, titre: title });
  }

  return sessions.sort((a, b) => a.num - b.num);
}

function buildProgrammeSessionsIndex() {
  const sessions = {};

  for (let week = 1; week <= 52; week += 1) {
    const filePath = path.join(__dirname, "programme_cap", `semaine_${week}.md`);
    if (!fs.existsSync(filePath)) continue;
    sessions[week] = extractSessionsFromWeekMarkdown(fs.readFileSync(filePath, "utf8"));
  }

  return sessions;
}

exports.programmeSessionsApi = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  res.status(200).json({ sessions: buildProgrammeSessionsIndex() });
});

// Endpoint d'API principal pour le coach
exports.coachApi = functions.https.onRequest(async (req, res) => {
  // Configurer CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { message, semaine_active, seance_active, seance_active_detail, contexte_eleve, historique_messages } = req.body;

    if (!message || !semaine_active || !contexte_eleve) {
      res.status(400).send("Bad Request: Missing required parameters");
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || functions.config().gemini?.key;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured in environment or functions config.");
      res.status(500).send("Internal Server Error: AI Service not configured");
      return;
    }

    // Lire le prompt système
    const basePromptPath = path.join(__dirname, "specs_coach_prompt.txt");
    let basePrompt = "Tu es Coach CAP Pâtissier.";
    if (fs.existsSync(basePromptPath)) {
      basePrompt = fs.readFileSync(basePromptPath, "utf8");
    }

    // Charger le contenu de la semaine active
    let coursSemaine = "";
    const coursPath = path.join(__dirname, "programme_cap", `semaine_${semaine_active}.md`);
    if (fs.existsSync(coursPath)) {
      coursSemaine = fs.readFileSync(coursPath, "utf8");
    } else {
      console.warn(`Curriculum file not found for week ${semaine_active} at path: ${coursPath}`);
    }

    // Construire les instructions système complètes en injectant le cours de la semaine
    const instructionsSysteme = `
${basePrompt}

=== COURS DE LA SEMAINE ACTIVE (Semaine ${semaine_active}) ===
Utilise ce cours comme référence thématique pour guider l'élève :
${coursSemaine}

=== SEANCE ACTIVE ===
- Position exacte : Semaine ${semaine_active} - S${seance_active || 1}
- Titre de la seance : ${seance_active_detail?.titre || "Seance non precisee"}
- Regle : commence tes reponses importantes en rappelant "Semaine ${semaine_active} - S${seance_active || 1}".
- Ne saute pas vers S2, S3, S4 ou S5 sauf si l'eleve le demande explicitement.

=== CONTEXTE ACTUEL DE L'ÉLÈVE ===
- Niveau : ${contexte_eleve.niveau}
- Type de four : ${contexte_eleve.type_four}
- Possède un robot pâtissier : ${contexte_eleve.a_robot ? "Oui" : "Non"}
- Objectif/Session : ${contexte_eleve.temps_disponible || "CAP Candidat Libre"}

=== RÈGLE CRITIQUE DE FORMAT ===
Tu dois répondre en français au format JSON structuré correspondant à ce schéma :
{
  "response_text": "Ta réponse formatée en Markdown, en français simple, encourageant et socratique...",
  "suggestions_rapides": ["Suggestion de question courte 1", "Suggestion de question courte 2", "Suggestion de question courte 3"]
}
Les suggestions rapides doivent être des questions courtes que l'élève pourrait te poser suite à ta réponse pour poursuivre l'apprentissage (max 50 caractères par suggestion).
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: instructionsSysteme,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // Formater l'historique des messages pour Gemini
    const contents = [];
    if (historique_messages && Array.isArray(historique_messages)) {
      historique_messages.forEach(msg => {
        contents.push({
          role: msg.role === "model" ? "model" : "user",
          parts: [{ text: msg.text }]
        });
      });
    }

    // Ajouter le nouveau message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const result = await model.generateContent({ contents });
    const responseText = result.response.text();

    res.status(200).send(responseText);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({
      response_text: "Oups ! Je rencontre un petit problème de connexion. Peux-tu reformuler ou réessayer dans quelques instants ?",
      suggestions_rapides: ["Réessayer", "Qu'est-ce qui bloque ?", "D'accord"]
    });
  }
});
