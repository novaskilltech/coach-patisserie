const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
  // Configurer CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { message, semaine_active, seance_active, seance_active_detail, contexte_eleve, historique_messages } = req.body;

    if (!message || !semaine_active || !contexte_eleve) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    // Récupérer la clé API depuis les variables d'environnement de Vercel
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      res.status(500).json({ error: "OpenRouter API Key not configured on Vercel" });
      return;
    }

    // Charger le prompt de base
    const promptPath = path.join(process.cwd(), "functions", "specs_coach_prompt.txt");
    let basePrompt = "Tu es Coach CAP Pâtissier.";
    if (fs.existsSync(promptPath)) {
      basePrompt = fs.readFileSync(promptPath, "utf8");
    }

    // Charger le cours de la semaine
    let coursSemaine = "";
    const coursPath = path.join(process.cwd(), "functions", "programme_cap", `semaine_${semaine_active}.md`);
    if (fs.existsSync(coursPath)) {
      coursSemaine = fs.readFileSync(coursPath, "utf8");
    }

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
  "response_text": "Ta réponse formatée en Markdown, en français simple, encourageant et pédagogique..."
}
Reste bien dans le rôle.
`;

    const messages = [
      { role: "system", content: instructionsSysteme }
    ];

    if (historique_messages && Array.isArray(historique_messages)) {
      historique_messages.forEach(msg => {
        messages.push({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.text
        });
      });
    }

    messages.push({ role: "user", content: message });

    // Appeler OpenRouter
    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.com",
        "X-Title": "CAP Patissier.AI"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        response_format: { type: "json_object" }
      })
    });

    const data = await openRouterRes.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      res.status(200).json(JSON.parse(data.choices[0].message.content));
    } else {
      throw new Error("Invalid response from OpenRouter: " + JSON.stringify(data));
    }

  } catch (err) {
    console.error("Vercel Function Error:", err);
    res.status(500).json({
      response_text: "Désolé, je rencontre une petite défaillance technique pour me connecter à mes fourneaux. Réessaie dans quelques instants !"
    });
  }
};
