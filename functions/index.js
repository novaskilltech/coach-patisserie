const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

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
    const { message, semaine_active, contexte_eleve, historique_messages } = req.body;

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
