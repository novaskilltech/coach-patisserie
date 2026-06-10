const http = require("http");
const fs = require("fs");
const path = require("path");

// Charger manuellement les variables d'environnement depuis le fichier .env
const envPath = path.join(__dirname, ".env");
let openRouterKey = process.env.OPENROUTER_API_KEY || "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/OPENROUTER_API_KEY=(.*)/);
  if (match && match[1]) {
    openRouterKey = match[1].trim();
  }
}

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, "public");
const FUNCTIONS_DIR = path.join(__dirname, "functions");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

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
    const filePath = path.join(FUNCTIONS_DIR, "programme_cap", `semaine_${week}.md`);
    if (!fs.existsSync(filePath)) continue;
    sessions[week] = extractSessionsFromWeekMarkdown(fs.readFileSync(filePath, "utf8"));
  }
  return sessions;
}

const server = http.createServer(async (req, res) => {
  // Gérer CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/programme-sessions" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ sessions: buildProgrammeSessionsIndex() }));
    return;
  }

  // Router API Coach
  if (req.url === "/api/coach" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { message, semaine_active, seance_active, seance_active_detail, contexte_eleve, historique_messages } = JSON.parse(body);

        if (!message || !semaine_active || !contexte_eleve) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing required parameters" }));
          return;
        }

        if (!openRouterKey) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "OpenRouter API Key not configured" }));
          return;
        }

        // Charger le prompt de base
        const promptPath = path.join(FUNCTIONS_DIR, "specs_coach_prompt.txt");
        let basePrompt = "Tu es Coach CAP Pâtissier.";
        if (fs.existsSync(promptPath)) {
          basePrompt = fs.readFileSync(promptPath, "utf8");
        }

        // Charger le cours de la semaine
        let coursSemaine = "";
        const coursPath = path.join(FUNCTIONS_DIR, "programme_cap", `semaine_${semaine_active}.md`);
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

        // Construire les messages pour OpenRouter
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
            "HTTP-Referer": "http://localhost:8080",
            "X-Title": "Coach CAP Patissier"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: messages,
            response_format: { type: "json_object" }
          })
        });

        const data = await openRouterRes.json();
        
        if (data.choices && data.choices[0] && data.choices[0].message) {
          const aiResponseText = data.choices[0].message.content;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(aiResponseText);
        } else {
          throw new Error("Invalid response from OpenRouter: " + JSON.stringify(data));
        }

      } catch (err) {
        console.error("API processing error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          response_text: "Désolé, je rencontre une petite défaillance technique pour me connecter à mes fourneaux. Vérifie ta connexion et réessaie !"
        }));
      }
    });
    return;
  }

  // Servir les fichiers statiques
  let filePath = path.join(PUBLIC_DIR, req.url === "/" ? "index.html" : req.url);
  
  // Sécurité élémentaire pour éviter la traversée de répertoires
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        res.writeHead(500);
        res.end("Internal Server Error: " + err.code);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🧁 Coach CAP Pâtissier démarré avec succès !`);
  console.log(`👉 Accéder localement : http://localhost:${PORT}`);
});
