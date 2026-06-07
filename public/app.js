// State variables
let state = {
  contexte_eleve: null,
  progression: [], // Liste des semaines complétées (1 à 56)
  semaine_active: 1,
  historique_messages: [],
  curriculum: null,
  is_premium: false
};

// Glossaire des termes techniques officiels CAP
const glossaire = [
  { terme: "Blanchir", definition: "Fouetter vigoureusement des jaunes d'œufs avec du sucre jusqu'à ce que le mélange s'éclaircisse et double de volume." },
  { terme: "Incorporer", definition: "Mélanger délicatement une substance légère (comme des blancs en neige ou de la crème fouettée) dans un appareil plus lourd, du bas vers le haut avec une maryse, pour ne pas casser les bulles d'air." },
  { terme: "Tamiser", definition: "Passer une matière sèche pulvérulente (farine, levure, cacao, sucre glace) à travers un tamis ou une passette fine pour éliminer les grumeaux et l'aérer." },
  { terme: "Chemiser", definition: "Tapisser les parois intérieures d'un moule de beurre puis de farine, ou de papier sulfurisé/ruban de rhodoïd, afin de faciliter le démoulage futur." },
  { terme: "Préchauffer", definition: "Mettre le four à température de cuisson demandée 10 à 15 minutes avant d'enfourner une préparation." },
  { terme: "Cuire à cœur", definition: "Assurer une cuisson homogène jusqu'au centre de la préparation. Se vérifie généralement en plantant la lame d'un couteau qui doit ressortir propre." },
  { terme: "Sablage", definition: "Mélanger du beurre froid en dés avec de la farine du bout des doigts jusqu'à obtenir une texture de sable fin. Cela enrobe le gluten de gras et rend les pâtes (sablée, brisée) friables." },
  { terme: "Crémage", definition: "Mélanger du beurre pommade (mou) avec du sucre au fouet ou à la spatule pour obtenir un mélange crémeux et blanchi." },
  { terme: "Foisonner", definition: "Introduire de l'air dans un appareil par action mécanique (fouettage) pour augmenter son volume et le rendre plus léger (ex: génoise, chantilly)." },
  { terme: "Dessécher", definition: "Travailler une préparation (comme la panade de la pâte à choux) sur le feu dans une casserole à l'aide d'une spatule pour en évaporer l'excès d'eau." }
];

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  loadStateFromStorage();
  await fetchCurriculumData();
  renderGlossaire(glossaire);
  
  if (state.contexte_eleve) {
    // Si l'élève a déjà configuré son profil, on affiche directement l'application
    document.getElementById("landingPageView").style.display = "none";
    document.getElementById("appWorkspaceView").style.display = "flex";
    updateDashboardUI();
  }
});

// Fonctions de transition Landing -> App
function startFreeTrial() {
  document.getElementById("onboardingModal").classList.add("active");
}

function openPremiumModal() {
  document.getElementById("premiumCohortModal").classList.add("active");
}

function closePremiumModal() {
  document.getElementById("premiumCohortModal").classList.remove("active");
}

function submitPremiumReservation(e) {
  e.preventDefault();
  const email = document.getElementById("premiumEmail").value;
  alert(`Félicitations ! Votre demande de réservation pour la cohorte du 15 Janvier 2027 avec l'adresse ${email} a bien été enregistrée. Notre équipe pédagogique va vous contacter sous 24h.`);
  closePremiumModal();
}

// Event Listeners Setup
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
      
      // Fermer le menu sidebar sur mobile après clic
      if (window.innerWidth <= 768) {
        document.getElementById("appSidebar").classList.remove("active");
      }
    });
  });

  // Mobile Menu Toggle
  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("appSidebar").classList.toggle("active");
  });

  // Onboarding Form Submit
  document.getElementById("onboardingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const niveau = document.getElementById("inputNiveau").value;
    const type_four = document.getElementById("inputFour").value;
    const a_robot = document.querySelector('input[name="inputRobot"]:checked').value === "true";
    const session = document.getElementById("inputSession").value;

    state.contexte_eleve = { niveau, type_four, a_robot, temps_disponible: session };
    saveStateToStorage();
    
    document.getElementById("onboardingModal").classList.remove("active");
    document.getElementById("landingPageView").style.display = "none";
    document.getElementById("appWorkspaceView").style.display = "flex";
    updateDashboardUI();
  });

  // Reset Data Btn
  document.getElementById("resetDataBtn").addEventListener("click", () => {
    if (confirm("Voulez-vous vraiment réinitialiser toute votre progression ? Cette action est irréversible.")) {
      localStorage.clear();
      location.reload();
    }
  });

  // Glossary Search
  document.getElementById("glossarySearch").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = glossaire.filter(item => 
      item.terme.toLowerCase().includes(query) || 
      item.definition.toLowerCase().includes(query)
    );
    renderGlossaire(filtered);
  });

  // Send Message Chat
  document.getElementById("sendChatBtn").addEventListener("click", sendMessageToCoach);
  document.getElementById("chatInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessageToCoach();
  });
}

// Alterner entre les onglets
function switchTab(tabId) {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  document.querySelectorAll(".tab-content").forEach(tab => {
    if (tab.id === `tab-${tabId}`) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });
}

// LocalStorage Management
function loadStateFromStorage() {
  const localContext = localStorage.getItem("contexte_eleve");
  const localProgression = localStorage.getItem("progression");
  const localPremium = localStorage.getItem("is_premium");
  
  if (localContext) {
    state.contexte_eleve = JSON.parse(localContext);
  }
  if (localProgression) {
    state.progression = JSON.parse(localProgression);
  }
  if (localPremium) {
    state.is_premium = JSON.parse(localPremium);
  }
}

function saveStateToStorage() {
  localStorage.setItem("contexte_eleve", JSON.stringify(state.contexte_eleve));
  localStorage.setItem("progression", JSON.stringify(state.progression));
  localStorage.setItem("is_premium", JSON.stringify(state.is_premium));
}

// Charger le programme JSON
async function fetchCurriculumData() {
  try {
    const response = await fetch("specs_curriculum_data.json");
    state.curriculum = await response.json();
  } catch (error) {
    console.error("Error loading curriculum data:", error);
  }
}

// Rendu graphique du programme
function updateDashboardUI() {
  if (!state.curriculum) return;

  if (state.contexte_eleve) {
    const fourMap = {
      "gaz": "Four à gaz 🔥",
      "électrique": "Four électrique ⚡",
      "chaleur_tournante": "Chaleur tournante 🌀"
    };
    document.getElementById("userOvenBadge").innerText = fourMap[state.contexte_eleve.type_four] || "Four électrique ⚡";
  }

  // Mettre à jour l'affichage du statut Premium
  const statusContainer = document.getElementById("premiumStatusContainer");
  if (statusContainer) {
    statusContainer.innerHTML = state.is_premium
      ? `<span class="badge-accent" style="background-color: var(--color-secondary); color: var(--text-main);">Accès Illimité Premium 💎</span>`
      : `<span class="badge-accent" style="background-color: var(--color-primary); color: var(--text-main); cursor:pointer;" onclick="openPremiumModal()">Mode Essai (S1-S5) 🎁 <strong style="text-decoration:underline; margin-left:8px;">Débloquer</strong></span>`;
  }

  const container = document.getElementById("curriculumContainer");
  container.innerHTML = "";

  state.curriculum.blocs.forEach(bloc => {
    const card = document.createElement("div");
    card.className = "bloc-card";
    
    card.innerHTML = `
      <div class="bloc-header">
        <h3>Bloc ${bloc.id} — ${bloc.titre}</h3>
      </div>
      <div class="weeks-grid">
        ${bloc.semaines.map(semaine => {
          const isCompleted = state.progression.includes(semaine.num);
          const isLocked = semaine.num > 5 && !state.is_premium;
          return `
            <div class="week-item ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}" data-week="${semaine.num}" style="${isLocked ? 'opacity: 0.7;' : ''}">
              <div class="week-badge">${isLocked ? '🔒 Premium' : (isCompleted ? '✅ Terminé' : `Semaine ${semaine.num}`)}</div>
              <h4>${semaine.titre}</h4>
              ${isLocked ? `
                <p style="font-size:0.75rem; color:#ff6b67; margin-top:8px; font-weight:700;">Réservé aux membres premium</p>
              ` : `
                <button class="toggle-complete-btn" style="margin-top:12px; background:none; border: 1px solid var(--border-light); font-size:0.75rem; padding:4px 8px; border-radius:4px; cursor:pointer;">
                  ${isCompleted ? "Marquer à faire" : "Marquer terminé"}
                </button>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attacher les écouteurs sur les semaines
    card.querySelectorAll(".week-item").forEach(item => {
      const num = parseInt(item.getAttribute("data-week"));
      const isLocked = num > 5 && !state.is_premium;
      
      item.addEventListener("click", (e) => {
        if (isLocked) {
          e.stopPropagation();
          openPremiumModal();
          return;
        }
        if (e.target.tagName === "BUTTON") {
          e.stopPropagation();
          toggleWeekCompletion(num);
          return;
        }
        selectWeek(num);
      });
    });

    container.appendChild(card);
  });

  updateGlobalProgressPercent();
}

// Cocher/Décocher une semaine
function toggleWeekCompletion(num) {
  const index = state.progression.indexOf(num);
  if (index > -1) {
    state.progression.splice(index, 1);
  } else {
    state.progression.push(num);
  }
  saveStateToStorage();
  updateDashboardUI();
}

// Mettre à jour le pourcentage global
function updateGlobalProgressPercent() {
  if (!state.curriculum) return;
  
  let totalWeeks = 0;
  state.curriculum.blocs.forEach(b => {
    totalWeeks += b.semaines.length;
  });
  
  const percentage = Math.round((state.progression.length / totalWeeks) * 100) || 0;
  document.getElementById("globalProgressPercent").innerText = `${percentage}% complété`;
}

// Sélectionner une semaine pour le chat
function selectWeek(weekNum) {
  state.semaine_active = weekNum;
  switchTab("chat");
  
  // Vider l'historique de chat pour repartir sur le cours de la semaine
  state.historique_messages = [];
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.innerHTML = `
    <div class="message assistant">
      <div class="message-bubble">
        <p>Prêt pour le programme de la <strong>Semaine ${weekNum}</strong> ? 🧁 Dis-moi par quoi tu veux commencer (Théorie, Base technique, Recette pas à pas, ou Quiz d'évaluation) !</p>
      </div>
    </div>
  `;
  
  // Charger les suggestions initiales
  renderSuggestions([
    "Explique-moi la théorie",
    "Je veux la recette pas-à-pas",
    "Lance le quiz d'évaluation"
  ]);
}

// Rendu du glossaire
function renderGlossaire(list) {
  const container = document.getElementById("glossaryGrid");
  container.innerHTML = "";
  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "glossary-card";
    card.innerHTML = `
      <h3>${item.terme}</h3>
      <p>${item.definition}</p>
    `;
    container.appendChild(card);
  });
}

// Rendu des suggestions
function renderSuggestions(suggestions) {
  const container = document.getElementById("quickReplies");
  container.innerHTML = "";
  suggestions.forEach(sug => {
    const btn = document.createElement("button");
    btn.className = "quick-reply-btn";
    btn.innerText = sug;
    btn.addEventListener("click", () => {
      sendMessageToCoach(sug);
    });
    container.appendChild(btn);
  });
}

// Envoyer un message au coach via Firebase Cloud Function
async function sendMessageToCoach(textOverride) {
  const inputEl = document.getElementById("chatInput");
  const messageText = typeof textOverride === "string" ? textOverride : inputEl.value.trim();
  
  if (!messageText) return;
  
  if (typeof textOverride !== "string") {
    inputEl.value = "";
  }

  // Afficher le message utilisateur
  appendMessage("user", messageText);
  
  // Afficher un loader temporaire pour l'assistant
  const loaderId = appendMessage("assistant", "Le chef réfléchit... ⏳");

  try {
    // Adapter cette URL lors du déploiement Firebase réel (ex: /api/coach géré par hosting rewrite)
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: messageText,
        semaine_active: state.semaine_active,
        contexte_eleve: state.contexte_eleve,
        historique_messages: state.historique_messages
      })
    });

    const data = await response.json();
    
    // Supprimer le loader
    document.getElementById(loaderId).remove();
    
    // Afficher la réponse
    appendMessage("assistant", data.response_text);
    
    // Mettre à jour l'historique
    state.historique_messages.push({ role: "user", text: messageText });
    state.historique_messages.push({ role: "model", text: data.response_text });
    // Limiter l'historique à 6 messages pour économiser de la bande passante
    if (state.historique_messages.length > 6) {
      state.historique_messages.shift();
      state.historique_messages.shift();
    }
    
    // Charger les suggestions rapides
    renderSuggestions(data.suggestions_rapides || ["D'accord", "Une autre question", "Fiche recette"]);

  } catch (error) {
    console.error("API Call error:", error);
    document.getElementById(loaderId).remove();
    appendMessage("assistant", "Désolé, je rencontre une petite défaillance technique pour me connecter à mes fourneaux. Vérifie ta connexion et réessaie !");
  }
}

// Ajouter un message à l'UI
function appendMessage(role, text) {
  const container = document.getElementById("chatMessages");
  const msgDiv = document.createElement("div");
  const id = "msg_" + Math.random().toString(36).substr(2, 9);
  
  msgDiv.className = `message ${role}`;
  msgDiv.id = id;
  msgDiv.innerHTML = `
    <div class="message-bubble">
      <p>${parseMarkdown(text)}</p>
    </div>
  `;
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  return id;
}

// Mini parseur markdown très simple pour l'UI
function parseMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// Simulation de paiement pour débloquer l'accès Premium
function simulatePayment(amount) {
  state.is_premium = true;
  saveStateToStorage();
  
  if (amount === 399) {
    alert("Félicitations ! Votre paiement unique de 399 € a bien été reçu. L'intégralité des 52 semaines de cours et le module Business sont désormais débloqués en Premium ! 💎");
  } else {
    alert("Félicitations ! Votre première mensualité a été reçue (500 € total en plusieurs mensualités). L'intégralité du programme et le module Business sont débloqués en Premium ! 💎");
  }
  
  closePremiumModal();
  updateDashboardUI();
}
