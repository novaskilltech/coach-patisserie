// State variables
let state = {
  contexte_eleve: null,
  progression: [], // Liste des semaines complétées (1 à 56)
  semaines_commencees: [],
  notes_apprenti: [],
  fiches_favorites: [],
  glossaire_favorites: [],
  week_checklists: {},
  sheet_statuses: {},
  recent_items: [],
  exam_date: "",
  exam_mode: {
    timerSeconds: 0,
    productions: {},
    scores: {}
  },
  gesture_evaluations: {},
  quiz_results: {},
  last_action: null,
  semaine_active: 1,
  seance_active: 1,
  seances_actives_par_semaine: {},
  programme_sessions: {},
  historique_messages: [],
  curriculum: null,
  is_premium: false
};

let supabaseClient = null;
let supabaseUser = null;

function getSupabasePublicConfig() {
  return window.NOVASKILLTECH_SUPABASE || {};
}

function isSupabaseConfigured() {
  const config = getSupabasePublicConfig();
  return Boolean(config.url && config.anonKey);
}

async function initSupabaseClient() {
  if (!isSupabaseConfigured()) {
    updateSupabaseStatus("Local", "warning");
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    updateSupabaseStatus("SDK absent", "warning");
    return;
  }

  const config = getSupabasePublicConfig();
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);

  const { data, error } = await supabaseClient.auth.getUser();
  if (!error) supabaseUser = data?.user || null;

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    supabaseUser = session?.user || null;
    updateSupabaseStatus();
    if (event === "SIGNED_IN" && supabaseUser) {
      await handleSupabaseSessionReady();
    }
  });

  updateSupabaseStatus();
  if (supabaseUser) {
    await handleSupabaseSessionReady();
  }
}

function updateSupabaseStatus(labelOverride, modeOverride) {
  const status = document.getElementById("supabaseStatus");
  const authBtn = document.getElementById("supabaseAuthBtn");
  const googleBtn = document.getElementById("supabaseGoogleBtn");
  const syncBtn = document.getElementById("supabaseSyncBtn");
  if (!status || !authBtn || !syncBtn || !googleBtn) return;

  status.classList.remove("connected", "warning");

  if (labelOverride) {
    status.textContent = labelOverride;
    if (modeOverride) status.classList.add(modeOverride);
  } else if (!isSupabaseConfigured()) {
    status.textContent = "Local";
    status.classList.add("warning");
  } else if (supabaseUser) {
    status.textContent = "Supabase";
    status.classList.add("connected");
  } else {
    status.textContent = "Non connecte";
    status.classList.add("warning");
  }

  authBtn.textContent = supabaseUser ? "Deconnexion" : "Email";
  googleBtn.disabled = !supabaseClient || Boolean(supabaseUser);
  syncBtn.disabled = !supabaseClient || !supabaseUser;
}

function isLandingAudioEnabled() {
  const landingPage = document.getElementById("landingPageView");
  const audioPlayer = document.getElementById("audioPlayerWidget");
  return Boolean(
    landingPage &&
    audioPlayer &&
    landingPage.style.display !== "none" &&
    audioPlayer.style.display !== "none"
  );
}

function disableLandingAudio() {
  const audioPlayer = document.getElementById("audioPlayerWidget");
  const introAudio = document.getElementById("introAudio");
  const playIcon = document.querySelector("#audioPlayPauseBtn .play-icon");
  const pauseIcon = document.querySelector("#audioPlayPauseBtn .pause-icon");
  const audioStatus = document.querySelector(".audio-status");
  const audioWave = document.getElementById("audioWave");
  const bubble = document.getElementById("chefSpeechBubble");

  if (introAudio && !introAudio.paused) introAudio.pause();
  if (audioPlayer) {
    audioPlayer.style.display = "none";
    audioPlayer.classList.remove("active");
  }
  if (playIcon) playIcon.style.display = "inline";
  if (pauseIcon) pauseIcon.style.display = "none";
  if (audioStatus) audioStatus.innerText = "Cliquez pour écouter";
  if (audioWave) audioWave.classList.remove("playing");
  if (bubble) {
    bubble.style.opacity = "0";
    bubble.style.transform = "translateY(10px) scale(0.95)";
  }
}

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

glossaire.push(
  { terme: "Abaisser", definition: "Etaler une pate au rouleau pour obtenir l'epaisseur et la forme souhaitees avant de foncer, detailler ou cuire." },
  { terme: "Abricoter", definition: "Recouvrir une tarte ou un entremets d'une fine couche de nappage abricot chaud pour proteger, faire briller et ameliorer la tenue." },
  { terme: "Appareil", definition: "Melange de plusieurs ingredients pret a etre cuit, monte, poche ou incorpore dans une preparation." },
  { terme: "Apprêter", definition: "Laisser fermenter une pate levee ou une viennoiserie faconnee avant cuisson pour qu'elle gagne en volume." },
  { terme: "Bain-marie", definition: "Technique de cuisson ou de maintien en temperature utilisant un recipient place dans de l'eau chaude pour chauffer doucement et regulierement." },
  { terme: "Bassiner", definition: "Ajouter progressivement de l'eau ou un liquide dans une pate en cours de petrissage pour ajuster son hydratation." },
  { terme: "Beurrer", definition: "Enduire un moule, une plaque ou un cercle de beurre pour limiter l'adherence et faciliter le demoulage." },
  { terme: "Bouler", definition: "Former une boule reguliere avec une pate afin de lui donner de la force et une surface tendue." },
  { terme: "Brider", definition: "Maintenir une forme avec une ficelle ou une attache; terme surtout utilise en cuisine, mais utile pour comprendre certains sujets mixtes." },
  { terme: "Calibrer", definition: "Donner une taille, un poids ou une epaisseur reguliere a des elements pour obtenir une cuisson et une presentation homogenes." },
  { terme: "Caraméliser", definition: "Chauffer du sucre ou une preparation sucree jusqu'a obtenir une coloration blonde a brune et des aromes de caramel." },
  { terme: "Chablonner", definition: "Enduire un biscuit, un fond de tarte ou un element sec d'une fine couche de chocolat pour l'isoler de l'humidite." },
  { terme: "Chiqueter", definition: "Realiser de petites entailles regulieres sur le bord d'une pate feuilletee pour souder, decorer et favoriser un developpement regulier." },
  { terme: "Clarifier", definition: "Separer les jaunes des blancs d'oeufs, ou rendre limpide un liquide en retirant ses impuretes." },
  { terme: "Coller", definition: "Ajouter de la gelatine ou un gelifiant dans une preparation afin de lui donner de la tenue apres refroidissement." },
  { terme: "Colorer", definition: "Donner une couleur controlee a une preparation par cuisson, dorure, caramelisation ou ajout de colorant autorise." },
  { terme: "Corner", definition: "Racler soigneusement un recipient avec une corne ou une maryse pour recuperer toute la preparation." },
  { terme: "Corser", definition: "Donner de l'elasticite et de la force a une pate par petrissage ou travail mecanique, notamment pour les pates levees et feuilletees." },
  { terme: "Coucher", definition: "Dresser une pate ou une creme a la poche sur plaque, par exemple des choux, eclairs, biscuits ou meringues." },
  { terme: "Crémer", definition: "Travailler du beurre pommade avec du sucre jusqu'a obtenir une texture cremeuse et homogene." },
  { terme: "Cribler", definition: "Passer un ingredient sec dans un tamis large pour separer les grains, retirer les impuretes ou aerer une poudre." },
  { terme: "Cuire à blanc", definition: "Cuire un fond de tarte sans garniture, souvent avec des poids de cuisson, pour obtenir une base croustillante et stable." },
  { terme: "Débarrasser", definition: "Transvaser une preparation dans un autre recipient pour stopper une cuisson, liberer le poste ou faciliter le refroidissement." },
  { terme: "Décercler", definition: "Retirer le cercle d'une tarte, d'un entremets ou d'un fond apres cuisson, prise au froid ou montage." },
  { terme: "Décuire", definition: "Ajouter un liquide dans un sucre cuit ou un caramel pour abaisser sa temperature et modifier sa concentration." },
  { terme: "Dégazer", definition: "Chasser une partie du gaz contenu dans une pate levee apres fermentation en l'appuyant ou en la rabattant." },
  { terme: "Détendre", definition: "Assouplir une preparation trop ferme en ajoutant progressivement un liquide, une creme ou une partie plus souple." },
  { terme: "Détailler", definition: "Decouper une pate, un biscuit, un fruit ou une preparation selon une forme et une dimension precises." },
  { terme: "Détrempe", definition: "Pate de base composee notamment de farine, eau et sel, utilisee avant incorporation du beurre dans un feuilletage." },
  { terme: "Dorer", definition: "Appliquer une fine couche d'oeuf battu, de jaune ou de dorure sur une pate pour favoriser la coloration a la cuisson." },
  { terme: "Dresser", definition: "Mettre en forme une preparation sur plaque, dans un moule ou sur un support a l'aide d'une poche, spatule ou cuillere." },
  { terme: "Ébarber", definition: "Retirer les excedents ou bavures d'une pate, d'un biscuit, d'un chocolat ou d'un element moule pour obtenir une finition nette." },
  { terme: "Écumer", definition: "Retirer l'ecume ou les impuretes qui remontent a la surface d'un liquide, d'un sirop ou d'une cuisson." },
  { terme: "Émulsionner", definition: "Melanger deux elements qui se combinent difficilement, comme eau et matiere grasse, pour obtenir une texture stable et lisse." },
  { terme: "Enfourner", definition: "Placer une preparation dans le four a la temperature prevue en respectant le bon emplacement et le bon moment." },
  { terme: "Enrober", definition: "Recouvrir regulierement un element de chocolat, de glacage, de sucre, de nappage ou d'une autre preparation." },
  { terme: "Étuver", definition: "Maintenir une pate levee dans une ambiance tiede et humide pour favoriser la fermentation avant cuisson." },
  { terme: "Fleurer", definition: "Saupoudrer legerement le plan de travail ou une pate avec de la farine pour eviter qu'elle colle pendant le travail." },
  { terme: "Foncer", definition: "Garnir un cercle ou un moule avec une abaisse de pate en appliquant bien les bords sans deformer la pate." },
  { terme: "Fraser", definition: "Ecraser une pate avec la paume de la main pour homogeneiser le melange sans trop developper le gluten." },
  { terme: "Garnir", definition: "Remplir une pate, un biscuit, un chou, un eclair, un entremets ou un moule avec une creme, une ganache ou une preparation." },
  { terme: "Glacer", definition: "Recouvrir une preparation d'un glacage, de fondant, de caramel, de sucre glace ou donner une finition brillante." },
  { terme: "Grainer", definition: "Perdre une texture lisse au profit de petits grains, souvent par fouettage excessif, mauvaise temperature ou incorporation incorrecte." },
  { terme: "Hydrater", definition: "Ajouter ou laisser absorber de l'eau dans un ingredient, une poudre, une gelatine, une pate ou une preparation." },
  { terme: "Imbiber", definition: "Humidifier un biscuit avec un sirop, un punch ou un liquide aromatise pour apporter moelleux et parfum." },
  { terme: "Infuser", definition: "Laisser un ingredient aromatique dans un liquide chaud ou froid pour en extraire les parfums." },
  { terme: "Laminer", definition: "Etaler une pate regulierement au laminoir ou au rouleau, notamment pour les pates feuilletees et viennoiseries." },
  { terme: "Lisser", definition: "Rendre une creme, une ganache, un glacage ou une surface reguliere et sans grumeaux." },
  { terme: "Lustrer", definition: "Donner de la brillance a une surface avec nappage, beurre clarifie, sirop, gel ou produit adapte." },
  { terme: "Macaronner", definition: "Travailler l'appareil a macaron pour obtenir une texture brillante, souple et rubanante sans le rendre trop liquide." },
  { terme: "Malaxer", definition: "Travailler une pate ou un melange pour l'assouplir, l'homogeneiser ou repartir les ingredients." },
  { terme: "Marbrer", definition: "Creer un effet visuel de veines ou de marbrures avec deux preparations de couleurs ou textures differentes." },
  { terme: "Masquer", definition: "Recouvrir entierement ou partiellement un entremets, un biscuit ou un gateau d'une creme, mousse, ganache ou glacage." },
  { terme: "Meringuer", definition: "Ajouter ou dresser de la meringue sur une preparation, puis la cuire, la secher ou la colorer selon le resultat attendu." },
  { terme: "Mettre au point", definition: "Amener le chocolat a une courbe de temperature precise pour obtenir brillance, cassant et bonne cristallisation." },
  { terme: "Monder", definition: "Retirer la peau d'un fruit ou d'un fruit sec apres ebouillantage ou passage rapide dans l'eau chaude." },
  { terme: "Monter", definition: "Fouetter une creme, des blancs ou un appareil pour incorporer de l'air, augmenter le volume et obtenir la tenue souhaitee." },
  { terme: "Mouler", definition: "Verser ou appliquer une preparation dans un moule pour lui donner une forme precise apres cuisson, prise ou refroidissement." },
  { terme: "Napper", definition: "Recouvrir une preparation d'une couche reguliere de sauce, creme, nappage ou glacage." },
  { terme: "Panade", definition: "Masse de base de la pate a choux obtenue apres cuisson de l'eau, du beurre, du sel, du sucre et de la farine avant ajout des oeufs." },
  { terme: "Parer", definition: "Retirer les parties irregulieres, abimees ou excedentaires pour obtenir une forme nette et exploitable." },
  { terme: "Pasteuriser", definition: "Chauffer une preparation a une temperature controlee pour reduire les micro-organismes tout en preservant les qualites du produit." },
  { terme: "Pâton", definition: "Morceau de pate pese, divise ou prepare pour etre faconne, toure, abaisse ou mis en fermentation." },
  { terme: "Pétrir", definition: "Travailler une pate pour melanger les ingredients, hydrater la farine et developper le reseau glutineux si necessaire." },
  { terme: "Piquer", definition: "Faire de petits trous dans une pate avec une fourchette ou un pique-vite pour limiter les gonflements a la cuisson." },
  { terme: "Pincer", definition: "Marquer le bord d'une pate avec une pince ou les doigts pour souder, decorer ou reguler la cuisson." },
  { terme: "Pocher", definition: "Dresser une preparation a la poche munie d'une douille, ou cuire doucement un aliment dans un liquide fremissant selon le contexte." },
  { terme: "Pointage", definition: "Premiere phase de fermentation d'une pate levee apres petrissage et avant division ou faconnage." },
  { terme: "Pousser", definition: "Laisser une pate levee fermenter pour augmenter de volume avant cuisson ou avant une etape de faconnage." },
  { terme: "Puncher", definition: "Imbiber un biscuit avec un sirop aromatise, parfois alcoolise, pour apporter moelleux et parfum." },
  { terme: "Rabattre", definition: "Replier ou degazer une pate pour renforcer sa structure, redistribuer les gaz et relancer la fermentation." },
  { terme: "Rayer", definition: "Tracer un decor regulier sur une pate doree avec la pointe d'un couteau ou d'une lame sans la couper profondement." },
  { terme: "Réduire", definition: "Faire evaporer une partie de l'eau d'un liquide par cuisson pour concentrer gout, texture ou sucre." },
  { terme: "Réserver", definition: "Mettre une preparation de cote, au froid ou a temperature adaptee, en attendant la prochaine etape." },
  { terme: "Resserrer", definition: "Redonner de la tenue a une creme, une meringue ou une preparation en la fouettant ou en ajustant sa texture." },
  { terme: "Rompre", definition: "Rabattre une pate levee pour chasser le gaz carbonique et controler la fermentation." },
  { terme: "Sabler", definition: "Melanger farine et matiere grasse jusqu'a obtenir une texture sableuse avant ajout du liquide ou des oeufs." },
  { terme: "Serrer", definition: "Ajouter du sucre progressivement dans des blancs montes pour stabiliser une meringue et obtenir une texture ferme et brillante." },
  { terme: "Singer", definition: "Saupoudrer de farine une preparation en cuisson pour lier; terme plus courant en cuisine mais parfois rencontre en technologie." },
  { terme: "Suprême", definition: "Quartier d'agrume leve sans peau ni membrane, utilise pour une finition nette ou une garniture." },
  { terme: "Tempérer", definition: "Controler la temperature du chocolat pour stabiliser ses cristaux et obtenir brillance, cassant et demoulage net." },
  { terme: "Tourer", definition: "Realiser des tours dans une pate feuilletee ou levee feuilletee en pliant et abaissant pour creer des couches regulieres." },
  { terme: "Travailler", definition: "Melanger, fouetter, petrir ou assouplir une preparation jusqu'a atteindre la texture demandee par la recette." },
  { terme: "Turbiner", definition: "Faire prendre une glace ou un sorbet dans une turbine ou sorbetiere en incorporant du froid et du mouvement." },
  { terme: "Vanner", definition: "Remuer une creme ou une sauce pendant son refroidissement pour eviter la formation d'une peau et conserver une texture lisse." },
  { terme: "Zester", definition: "Prelever uniquement la partie coloree de l'ecorce d'un agrume, sans la partie blanche amere." },
  { terme: "Biscuit Joconde", definition: "Biscuit souple a base d'amande, souvent utilise pour les entremets, decors, operas et montages fins." },
  { terme: "Biscuit cuillère", definition: "Biscuit leger a base d'oeufs montes, utilise pour charlottes, entremets et tiramisus." },
  { terme: "Crème anglaise", definition: "Creme liquide cuite a la nappe, composee de lait ou creme, jaunes d'oeufs et sucre, souvent utilisee comme sauce ou base." },
  { terme: "Crème diplomate", definition: "Creme patissiere collee a la gelatine puis allegee avec une creme fouettee pour obtenir une texture souple et legere." },
  { terme: "Crème mousseline", definition: "Creme patissiere enrichie au beurre, montee pour devenir plus foisonnee; souvent utilisee dans le fraisier." },
  { terme: "Crème pâtissière", definition: "Creme cuite a base de lait, jaunes ou oeufs, sucre et amidon, utilisee pour tartes, choux, eclairs et garnitures." },
  { terme: "Crème prise", definition: "Appareil liquide a base d'oeufs et de lait ou creme qui coagule a la cuisson, comme un flan ou une creme caramel." },
  { terme: "Crème montée", definition: "Creme liquide fouettee jusqu'a obtenir une texture aerienne; elle peut etre souple, ferme ou incorporee dans une mousse." },
  { terme: "Dacquoise", definition: "Biscuit a base de blancs montes, sucre et poudres de fruits secs, utilise comme fond d'entremets ou biscuit de montage." },
  { terme: "Dorure", definition: "Melange applique au pinceau sur une pate avant cuisson pour favoriser la coloration et la brillance." },
  { terme: "Feuilletage", definition: "Pate composee de couches alternees de detrempe et de beurre, developpees par tours successifs." },
  { terme: "Ganache", definition: "Emulsion de chocolat et de creme ou liquide chaud, utilisee en garniture, glacage, fourrage ou montage." },
  { terme: "Glaçage miroir", definition: "Glacage brillant applique a temperature controlee sur un entremets froid pour obtenir une surface lisse et reflechissante." },
  { terme: "Meringue française", definition: "Meringue obtenue en montant des blancs d'oeufs avec du sucre, utilisee pour biscuits, decors ou fonds a secher." },
  { terme: "Meringue italienne", definition: "Meringue realisee avec un sirop de sucre cuit verse sur des blancs montes, stable et adaptee aux mousses et decors." },
  { terme: "Meringue suisse", definition: "Meringue chauffee au bain-marie avec sucre et blancs avant foisonnement, dense, brillante et stable." },
  { terme: "Nappage", definition: "Preparation gelifiee ou sirupeuse appliquee sur tartes et fruits pour proteger, faire briller et limiter le dessechement." },
  { terme: "Pâte à bombe", definition: "Appareil mousseux a base de jaunes d'oeufs fouettes avec un sucre cuit, utilise pour mousses, parfaits et cremes." },
  { terme: "Pâte à choux", definition: "Pate cuite en deux temps, d'abord dessechee en casserole puis cuite au four, utilisee pour choux, eclairs et religieuses." },
  { terme: "Pâte brisée", definition: "Pate friable peu sucree ou non sucree, obtenue par sablage ou melange, utilisee pour tartes et fonds." },
  { terme: "Pâte levée", definition: "Pate contenant de la levure biologique et fermentant avant cuisson, comme brioche ou certaines bases de viennoiserie." },
  { terme: "Pâte levée feuilletée", definition: "Pate fermentee contenant des couches de beurre par tourage, utilisee pour croissants et pains au chocolat." },
  { terme: "Pâte sablée", definition: "Pate riche en beurre a texture friable, obtenue par sablage, adaptee aux fonds de tartes et biscuits." },
  { terme: "Pâte sucrée", definition: "Pate sucree et friable, souvent realisee par cremage, utilisee pour fonds de tartes nets et croustillants." },
  { terme: "Sirop", definition: "Melange d'eau et de sucre porte a ebullition, utilise pour imbiber, cuire, conserver, decorer ou aromatiser." }
);

glossaire.sort((a, b) => a.terme.localeCompare(b.terme, "fr", { sensitivity: "base" }));

const fichesTechniques = [
  {
    titre: "Pâte à choux",
    categorie: "Pâtes de base",
    temps: "45 min + cuisson",
    objectif: "Obtenir des choux ou éclairs réguliers, creux, secs à coeur et bien développés.",
    materiel: ["Casserole", "Spatule", "Poche à douille", "Plaque", "Douille unie"],
    etapes: ["Porter eau, beurre, sel et sucre à ébullition.", "Ajouter la farine hors du feu et mélanger vivement.", "Dessécher la panade sur feu moyen.", "Incorporer les oeufs progressivement.", "Pocher régulièrement puis cuire sans ouvrir le four au départ."],
    controles: ["Pâte souple formant un ruban épais", "Choux réguliers et dorés", "Intérieur creux et non humide", "Pas d'affaissement après cuisson"]
  },
  {
    titre: "Crème pâtissière",
    categorie: "Crèmes",
    temps: "25 min + refroidissement",
    objectif: "Réaliser une crème lisse, brillante, bien cuite et stable pour tartes, choux et éclairs.",
    materiel: ["Casserole", "Fouet", "Cul-de-poule", "Film alimentaire", "Plaque froide"],
    etapes: ["Chauffer le lait avec l'arôme.", "Blanchir oeufs ou jaunes avec sucre puis ajouter l'amidon.", "Verser le lait chaud progressivement.", "Cuire à ébullition en fouettant.", "Débarrasser, filmer au contact et refroidir rapidement."],
    controles: ["Crème sans grumeaux", "Ébullition maintenue pour cuire l'amidon", "Film au contact", "Refroidissement rapide pour l'hygiène"]
  },
  {
    titre: "Pâte sucrée",
    categorie: "Fonds de tarte",
    temps: "30 min + repos",
    objectif: "Préparer un fond net, friable et régulier pour tartes fines ou tartelettes.",
    materiel: ["Robot ou cul-de-poule", "Rouleau", "Corne", "Film", "Cercle à tarte"],
    etapes: ["Crémer beurre pommade et sucre glace.", "Ajouter oeuf puis poudres sans trop travailler.", "Former un pâton plat.", "Réserver au froid.", "Abaisser puis foncer le cercle."],
    controles: ["Pâte homogène non élastique", "Repos suffisant", "Épaisseur régulière", "Angles bien marqués au fonçage"]
  },
  {
    titre: "Fonçage d'un cercle",
    categorie: "Gestes techniques",
    temps: "15 min",
    objectif: "Garnir un cercle sans déformer la pâte pour obtenir des bords droits et une cuisson régulière.",
    materiel: ["Cercle", "Rouleau", "Couteau", "Fourchette", "Plaque"],
    etapes: ["Fleurer légèrement le plan de travail.", "Abaisser la pâte à épaisseur régulière.", "Déposer dans le cercle sans tirer.", "Marquer l'angle avec les doigts.", "Araser, piquer puis réserver au froid."],
    controles: ["Pas de pâte étirée", "Angle droit bien formé", "Bords nets", "Fond piqué régulièrement"]
  },
  {
    titre: "Crème d'amande",
    categorie: "Crèmes",
    temps: "20 min",
    objectif: "Obtenir une crème homogène pour garnir tartes, galettes et fonds cuits.",
    materiel: ["Cul-de-poule", "Spatule", "Balance", "Poche"],
    etapes: ["Crémer beurre pommade et sucre.", "Ajouter les oeufs progressivement.", "Incorporer poudre d'amande et farine si prévue.", "Parfumer sans foisonner excessivement.", "Utiliser ou réserver au froid."],
    controles: ["Texture souple", "Pas de beurre fondu", "Mélange non tranché", "Dosage régulier en fond de tarte"]
  },
  {
    titre: "Ganache chocolat",
    categorie: "Chocolat",
    temps: "20 min + cristallisation",
    objectif: "Réaliser une émulsion lisse, brillante et stable pour garnir, glacer ou monter.",
    materiel: ["Casserole", "Maryse", "Mixeur plongeant", "Cul-de-poule"],
    etapes: ["Chauffer la crème ou le liquide.", "Verser en plusieurs fois sur le chocolat.", "Émulsionner au centre à la maryse.", "Mixer sans incorporer d'air si besoin.", "Filmer au contact et laisser cristalliser."],
    controles: ["Surface brillante", "Texture lisse", "Pas de séparation grasse", "Température adaptée à l'usage"]
  },
  {
    titre: "Meringue française",
    categorie: "Meringues",
    temps: "20 min + cuisson/séchage",
    objectif: "Monter des blancs stables pour biscuits, coques, décors ou fonds meringués.",
    materiel: ["Robot ou batteur", "Cul-de-poule", "Poche", "Douille"],
    etapes: ["Monter les blancs à vitesse moyenne.", "Ajouter le sucre progressivement.", "Serrer jusqu'au bec ferme.", "Pocher aussitôt.", "Cuire ou sécher selon la recette."],
    controles: ["Bec ferme et brillant", "Sucre bien dissous", "Pochage net", "Meringue sèche et non collante si cuisson longue"]
  },
  {
    titre: "Génoise",
    categorie: "Biscuits",
    temps: "35 min",
    objectif: "Obtenir un biscuit léger, régulier et souple pour entremets et montages.",
    materiel: ["Bain-marie", "Batteur", "Maryse", "Moule ou plaque"],
    etapes: ["Chauffer oeufs et sucre au bain-marie en fouettant.", "Monter jusqu'au ruban.", "Incorporer la farine tamisée délicatement.", "Mouler ou étaler.", "Cuire puis démouler avec soin."],
    controles: ["Appareil au ruban", "Farine incorporée sans casser la mousse", "Cuisson blonde", "Biscuit souple non sec"]
  },
  {
    titre: "Pâte feuilletée",
    categorie: "Pâtes tourées",
    temps: "2 h avec repos",
    objectif: "Créer une alternance régulière de détrempe et beurre pour un développement net à la cuisson.",
    materiel: ["Rouleau", "Corne", "Film", "Réfrigérateur", "Farine de fleurage"],
    etapes: ["Préparer la détrempe et le beurre de tourage.", "Enfermer le beurre dans la détrempe.", "Abaisser régulièrement.", "Réaliser les tours avec repos au froid.", "Détailler sans écraser les bords."],
    controles: ["Beurre et détrempe de texture proche", "Angles réguliers", "Repos respectés", "Bords non écrasés au détaillage"]
  },
  {
    titre: "Brioche",
    categorie: "Pâtes levées",
    temps: "3 h + repos froid possible",
    objectif: "Obtenir une pâte souple, filante, bien fermentée et dorée après cuisson.",
    materiel: ["Robot pétrin", "Corne", "Moule", "Pinceau", "Balance"],
    etapes: ["Pétrir farine, oeufs, levure, sucre et sel séparé de la levure.", "Incorporer le beurre progressivement.", "Pointer la pâte.", "Rabattre puis réserver au froid si besoin.", "Façonner, apprêter, dorer et cuire."],
    controles: ["Pâte élastique et lisse", "Beurre bien incorporé", "Apprêt suffisant", "Cuisson dorée et mie filante"]
  },
  {
    titre: "Tarte aux fruits",
    categorie: "Montage",
    temps: "1 h 15",
    objectif: "Assembler un fond croustillant, une crème stable et des fruits taillés proprement.",
    materiel: ["Cercle", "Poche", "Spatule", "Pinceau", "Couteau d'office"],
    etapes: ["Cuire le fond à blanc.", "Détendre puis pocher la crème.", "Préparer et parer les fruits.", "Disposer harmonieusement.", "Napper pour protéger et faire briller."],
    controles: ["Fond sec et croustillant", "Crème régulière", "Fruits propres et calibrés", "Nappage fin sans surcharge"]
  },
  {
    titre: "Organisation poste CAP",
    categorie: "Examen",
    temps: "Toute l'épreuve",
    objectif: "Maintenir un poste propre, logique et efficace pendant une production d'examen.",
    materiel: ["Torchons", "Bacs", "Balance", "Maryses", "Planning de travail"],
    etapes: ["Lire le sujet entièrement.", "Lister les préparations et temps de repos.", "Peser les matières premières.", "Lancer les cuissons et refroidissements prioritaires.", "Nettoyer régulièrement le poste."],
    controles: ["Plan de travail dégagé", "Pesées identifiées", "Respect marche en avant", "Aucune perte de temps sur les temps froids ou cuissons"]
  }
];

fichesTechniques.push(
  {
    titre: "Pâte brisée",
    categorie: "Fonds de tarte",
    temps: "25 min + repos",
    objectif: "Obtenir une pâte peu friable, régulière et adaptée aux tartes salées ou sucrées simples.",
    materiel: ["Cul-de-poule", "Corne", "Rouleau", "Film", "Cercle ou moule"],
    etapes: ["Sabler farine, sel et beurre froid.", "Ajouter l'eau progressivement.", "Assembler sans pétrir longuement.", "Former un pâton plat.", "Réserver au froid avant abaissage."],
    controles: ["Pâte non élastique", "Beurre non fondu", "Repos respecté", "Épaisseur régulière après abaissage"]
  },
  {
    titre: "Pâte sablée",
    categorie: "Fonds de tarte",
    temps: "30 min + repos",
    objectif: "Réaliser une pâte friable et fondante pour fonds de tarte, biscuits et petits fours.",
    materiel: ["Robot ou cul-de-poule", "Corne", "Rouleau", "Film", "Plaque"],
    etapes: ["Sabler farine et beurre froid.", "Ajouter sucre, oeuf et poudres selon la recette.", "Assembler rapidement.", "Abaisser entre deux feuilles si besoin.", "Réserver au froid avant cuisson."],
    controles: ["Texture sableuse au départ", "Pâte peu travaillée", "Froid suffisant", "Fond croustillant après cuisson"]
  },
  {
    titre: "Cuisson à blanc",
    categorie: "Gestes techniques",
    temps: "20 à 30 min",
    objectif: "Cuire un fond de tarte sans garniture pour obtenir une base sèche, stable et croustillante.",
    materiel: ["Cercle", "Plaque", "Papier cuisson", "Poids de cuisson", "Fourchette"],
    etapes: ["Foncer et piquer le fond.", "Réserver au froid.", "Garnir de papier et poids.", "Cuire jusqu'à tenue des bords.", "Retirer les poids et finir la coloration."],
    controles: ["Bords non affaissés", "Fond sec", "Coloration homogène", "Aucune zone crue au centre"]
  },
  {
    titre: "Crème anglaise",
    categorie: "Crèmes",
    temps: "25 min + refroidissement",
    objectif: "Cuire une crème à la nappe sans coaguler les jaunes pour servir de sauce ou de base à mousse.",
    materiel: ["Casserole", "Fouet", "Spatule", "Chinois", "Thermomètre"],
    etapes: ["Chauffer lait ou crème avec l'arôme.", "Blanchir jaunes et sucre.", "Verser le liquide chaud progressivement.", "Cuire à la nappe en remuant.", "Chinoiser et refroidir rapidement."],
    controles: ["Cuisson autour de 82 à 84 °C", "Texture nappante", "Aucun grain d'oeuf coagulé", "Refroidissement rapide"]
  },
  {
    titre: "Crème diplomate",
    categorie: "Crèmes",
    temps: "45 min + refroidissement",
    objectif: "Alléger une crème pâtissière collée avec de la crème montée pour garnir tartes et entremets.",
    materiel: ["Casserole", "Fouet", "Maryse", "Batteur", "Poche"],
    etapes: ["Réaliser une crème pâtissière.", "Ajouter la gélatine hydratée à chaud.", "Refroidir sans laisser figer totalement.", "Détendre la crème.", "Incorporer la crème montée délicatement."],
    controles: ["Crème lisse avant incorporation", "Gélatine bien fondue", "Crème montée souple", "Texture légère mais stable"]
  },
  {
    titre: "Crème mousseline",
    categorie: "Crèmes",
    temps: "45 min + refroidissement",
    objectif: "Monter une crème pâtissière au beurre pour obtenir une garniture foisonnée et stable, notamment pour fraisier.",
    materiel: ["Casserole", "Batteur", "Fouet", "Maryse", "Thermomètre"],
    etapes: ["Réaliser une crème pâtissière.", "Refroidir à température compatible avec le beurre.", "Crémer le beurre pommade.", "Incorporer la crème progressivement.", "Foisonner jusqu'à texture légère."],
    controles: ["Beurre pommade non fondu", "Températures proches", "Crème non tranchée", "Tenue suffisante au montage"]
  },
  {
    titre: "Crème chantilly",
    categorie: "Crèmes",
    temps: "15 min",
    objectif: "Monter une crème froide et stable pour décors, garnitures ou incorporation dans une mousse.",
    materiel: ["Batteur", "Cul-de-poule froid", "Fouet", "Poche"],
    etapes: ["Refroidir crème, bol et fouet.", "Monter à vitesse progressive.", "Ajouter sucre ou arôme selon recette.", "Arrêter à texture souple ou ferme selon usage.", "Utiliser rapidement ou réserver au froid."],
    controles: ["Crème suffisamment grasse et froide", "Texture lisse", "Pas de grainage", "Tenue adaptée au pochage"]
  },
  {
    titre: "Meringue italienne",
    categorie: "Meringues",
    temps: "25 min",
    objectif: "Obtenir une meringue stable avec sirop cuit pour mousses, tartes meringuées et décors.",
    materiel: ["Casserole", "Thermomètre", "Batteur", "Fouet"],
    etapes: ["Cuire le sucre avec l'eau.", "Commencer à monter les blancs.", "Verser le sirop en filet sur les blancs.", "Fouetter jusqu'à refroidissement partiel.", "Utiliser selon la recette."],
    controles: ["Sirop à bonne température", "Versement hors du fouet", "Meringue brillante", "Bec ferme et stable"]
  },
  {
    titre: "Biscuit cuillère",
    categorie: "Biscuits",
    temps: "30 min",
    objectif: "Réaliser un biscuit léger et régulier pour charlottes, entremets et fonds pochés.",
    materiel: ["Batteur", "Maryse", "Poche", "Douille unie", "Tamis"],
    etapes: ["Monter les blancs avec le sucre.", "Incorporer les jaunes.", "Ajouter farine tamisée délicatement.", "Pocher bandes ou cartouchières.", "Poudrer et cuire."],
    controles: ["Appareil mousseux", "Pochage régulier", "Surface perlée si poudrage", "Biscuit souple non cassant"]
  },
  {
    titre: "Dacquoise",
    categorie: "Biscuits",
    temps: "35 min",
    objectif: "Préparer un biscuit aux fruits secs, moelleux et stable pour fonds d'entremets.",
    materiel: ["Batteur", "Maryse", "Tamis", "Poche", "Plaque"],
    etapes: ["Monter les blancs et serrer au sucre.", "Mélanger poudres et sucre glace.", "Incorporer délicatement.", "Pocher selon gabarit.", "Cuire jusqu'à légère coloration."],
    controles: ["Meringue stable", "Poudres tamisées", "Épaisseur régulière", "Biscuit moelleux au centre"]
  },
  {
    titre: "Biscuit Joconde",
    categorie: "Biscuits",
    temps: "35 min",
    objectif: "Obtenir un biscuit amande fin, souple et régulier pour opéras, entremets et décors.",
    materiel: ["Batteur", "Maryse", "Plaque", "Spatule coudée", "Tamis"],
    etapes: ["Monter oeufs, sucre glace et poudre d'amande.", "Incorporer farine.", "Ajouter beurre fondu refroidi.", "Incorporer les blancs montés.", "Étaler finement et cuire rapidement."],
    controles: ["Appareil aéré", "Épaisseur homogène", "Cuisson courte", "Biscuit souple après refroidissement"]
  },
  {
    titre: "Financiers",
    categorie: "Gâteaux de voyage",
    temps: "30 min",
    objectif: "Réaliser des petits gâteaux moelleux à base de beurre noisette et poudre d'amande.",
    materiel: ["Casserole", "Chinois", "Cul-de-poule", "Moules", "Poche"],
    etapes: ["Réaliser un beurre noisette.", "Mélanger poudres et blancs.", "Ajouter le beurre filtré.", "Pocher en moules.", "Cuire jusqu'à coloration blonde."],
    controles: ["Beurre noisette non brûlé", "Appareil homogène", "Moules remplis régulièrement", "Bords dorés et coeur moelleux"]
  },
  {
    titre: "Madeleines",
    categorie: "Gâteaux de voyage",
    temps: "30 min + repos",
    objectif: "Obtenir des madeleines régulières avec une bosse marquée et une texture moelleuse.",
    materiel: ["Cul-de-poule", "Fouet", "Moules", "Poche", "Réfrigérateur"],
    etapes: ["Mélanger oeufs et sucre.", "Ajouter farine et levure.", "Incorporer beurre fondu refroidi.", "Réserver au froid.", "Pocher et cuire avec choc thermique."],
    controles: ["Appareil reposé", "Moules graissés", "Remplissage régulier", "Bosse visible après cuisson"]
  },
  {
    titre: "Cake de voyage",
    categorie: "Gâteaux de voyage",
    temps: "50 min à 1 h",
    objectif: "Réaliser un cake régulier, moelleux et bien cuit à coeur.",
    materiel: ["Moule à cake", "Batteur ou fouet", "Maryse", "Balance", "Four"],
    etapes: ["Préparer l'appareil selon méthode crémage ou mélange.", "Incorporer les poudres sans excès.", "Garnir le moule régulièrement.", "Cuire à température adaptée.", "Vérifier la cuisson à coeur."],
    controles: ["Appareil homogène", "Moule chemisé", "Développement régulier", "Lame propre en fin de cuisson"]
  },
  {
    titre: "Éclair classique",
    categorie: "Pâte à choux",
    temps: "1 h 15",
    objectif: "Produire des éclairs droits, réguliers, garnis proprement et glacés sans surcharge.",
    materiel: ["Poche", "Douille PF ou unie", "Plaque", "Couteau", "Spatule"],
    etapes: ["Préparer la pâte à choux.", "Pocher des éclairs réguliers.", "Cuire et sécher correctement.", "Garnir avec crème pâtissière.", "Glacer au fondant ou chocolat."],
    controles: ["Longueur régulière", "Éclairs secs et creux", "Garnissage suffisant", "Glaçage net et brillant"]
  },
  {
    titre: "Religieuse",
    categorie: "Pâte à choux",
    temps: "1 h 30",
    objectif: "Assembler deux choux garnis avec glaçage et crème décorative, de manière stable et nette.",
    materiel: ["Poche", "Douilles", "Plaque", "Spatule", "Couteau"],
    etapes: ["Pocher gros et petits choux calibrés.", "Cuire et refroidir.", "Garnir chaque chou.", "Glacer les sommets.", "Assembler et décorer avec crème au beurre ou crème adaptée."],
    controles: ["Choux de tailles cohérentes", "Assemblage stable", "Glaçage propre", "Décor régulier"]
  },
  {
    titre: "Paris-Brest",
    categorie: "Pâte à choux",
    temps: "1 h 30",
    objectif: "Réaliser une couronne de pâte à choux garnie d'une crème pralinée régulière.",
    materiel: ["Poche", "Douille cannelée", "Plaque", "Couteau scie", "Batteur"],
    etapes: ["Pocher une couronne régulière.", "Parsemer d'amandes si prévu.", "Cuire et sécher.", "Ouvrir proprement après refroidissement.", "Garnir de crème pralinée et refermer."],
    controles: ["Couronne régulière", "Cuisson sèche", "Découpe nette", "Garnissage stable et lisible"]
  },
  {
    titre: "Tarte citron meringuée",
    categorie: "Tartes",
    temps: "1 h 30",
    objectif: "Assembler un fond croustillant, une crème citron équilibrée et une meringue stable.",
    materiel: ["Cercle", "Casserole", "Fouet", "Poche", "Chalumeau"],
    etapes: ["Cuire le fond à blanc.", "Préparer la crème citron.", "Garnir et lisser.", "Réaliser la meringue.", "Pocher puis colorer."],
    controles: ["Fond sec", "Crème citron lisse", "Équilibre acidité-sucre", "Meringue brillante et stable"]
  },
  {
    titre: "Tarte Bourdaloue",
    categorie: "Tartes",
    temps: "1 h 15",
    objectif: "Réaliser une tarte aux poires avec crème d'amande, cuisson homogène et présentation régulière.",
    materiel: ["Cercle", "Rouleau", "Poche", "Couteau", "Pinceau"],
    etapes: ["Foncer le cercle.", "Garnir de crème d'amande.", "Disposer les poires tranchées.", "Cuire jusqu'à coloration.", "Napper après refroidissement partiel."],
    controles: ["Fond bien foncé", "Crème cuite à coeur", "Poires régulières", "Nappage fin et brillant"]
  },
  {
    titre: "Flan pâtissier",
    categorie: "Tartes",
    temps: "1 h + refroidissement",
    objectif: "Obtenir un flan bien cuit, lisse, découpable et sans détremper le fond.",
    materiel: ["Cercle", "Casserole", "Fouet", "Plaque", "Réfrigérateur"],
    etapes: ["Foncer le cercle.", "Préparer l'appareil à flan.", "Verser sur le fond froid.", "Cuire jusqu'à coloration.", "Refroidir complètement avant découpe."],
    controles: ["Appareil sans grumeaux", "Fond non détrempé", "Surface colorée", "Tenue nette à la coupe"]
  },
  {
    titre: "Mille-feuille",
    categorie: "Feuilletage",
    temps: "1 h 30",
    objectif: "Monter des couches de feuilletage cuit et crème avec une découpe nette et un glaçage régulier.",
    materiel: ["Plaques", "Grille", "Couteau scie", "Poche", "Spatule"],
    etapes: ["Cuire le feuilletage entre plaques.", "Détailler les bandes.", "Préparer la crème.", "Monter en couches régulières.", "Glacer ou poudrer selon finition."],
    controles: ["Feuilletage sec et croustillant", "Couches alignées", "Crème stable", "Découpe nette"]
  },
  {
    titre: "Galette des rois",
    categorie: "Feuilletage",
    temps: "1 h 30 + repos",
    objectif: "Réaliser une galette feuilletée bien soudée, garnie régulièrement et rayée proprement.",
    materiel: ["Rouleau", "Pinceau", "Couteau", "Plaque", "Poche"],
    etapes: ["Abaisser deux disques de feuilletage.", "Garnir de crème d'amande ou frangipane.", "Souder sans emprisonner trop d'air.", "Dorer et rayer.", "Cuire jusqu'à développement complet."],
    controles: ["Soudure efficace", "Rayage net", "Développement régulier", "Fond bien cuit"]
  },
  {
    titre: "Croissants",
    categorie: "Viennoiseries",
    temps: "3 h + repos",
    objectif: "Réaliser des croissants réguliers, alvéolés et bien feuilletés.",
    materiel: ["Rouleau", "Couteau", "Plaque", "Pinceau", "Réfrigérateur"],
    etapes: ["Préparer la pâte levée feuilletée.", "Tourer avec repos.", "Détailler des triangles réguliers.", "Façonner sans serrer excessivement.", "Apprêter, dorer et cuire."],
    controles: ["Beurre non fondu au tourage", "Triangles calibrés", "Apprêt maîtrisé", "Feuilletage visible après cuisson"]
  },
  {
    titre: "Pains au chocolat",
    categorie: "Viennoiseries",
    temps: "3 h + repos",
    objectif: "Façonner des pains au chocolat réguliers avec barres bien positionnées et feuilletage développé.",
    materiel: ["Rouleau", "Couteau", "Plaque", "Pinceau", "Barres chocolat"],
    etapes: ["Abaisser la pâte levée feuilletée.", "Détailler des rectangles réguliers.", "Placer les barres chocolat.", "Rouler sans écraser.", "Apprêter, dorer et cuire."],
    controles: ["Dimensions régulières", "Fermeture sous la pièce", "Dorure sans coulure", "Cuisson dorée et feuilletée"]
  },
  {
    titre: "Chaussons aux pommes",
    categorie: "Feuilletage",
    temps: "1 h 15",
    objectif: "Réaliser des chaussons garnis, soudés et rayés avec une cuisson croustillante.",
    materiel: ["Rouleau", "Emporte-pièce", "Pinceau", "Couteau", "Plaque"],
    etapes: ["Abaisser le feuilletage.", "Détailler les formes.", "Garnir de compote froide.", "Souder les bords.", "Dorer, rayer et cuire."],
    controles: ["Garniture froide", "Soudure nette", "Rayage sans percer", "Feuilletage bien développé"]
  },
  {
    titre: "Fraisier",
    categorie: "Entremets",
    temps: "2 h + prise au froid",
    objectif: "Monter un entremets régulier avec biscuit, crème mousseline et fraises calibrées.",
    materiel: ["Cercle", "Rhodoïd", "Poche", "Spatule", "Couteau"],
    etapes: ["Préparer biscuit et crème mousseline.", "Chemiser le cercle.", "Placer les fraises contre le rhodoïd.", "Garnir sans poches d'air.", "Fermer, lisser et réserver au froid."],
    controles: ["Fraises régulières", "Crème stable", "Montage droit", "Découpe nette après prise"]
  },
  {
    titre: "Entremets mousse fruits",
    categorie: "Entremets",
    temps: "2 h + prise au froid",
    objectif: "Assembler biscuit, mousse et insert pour obtenir un entremets stable, lisse et équilibré.",
    materiel: ["Cercle ou moule", "Rhodoïd", "Maryse", "Spatule", "Congélateur"],
    etapes: ["Préparer le biscuit.", "Réaliser l'insert si prévu.", "Monter la mousse.", "Assembler en évitant les bulles.", "Bloquer au froid avant finition."],
    controles: ["Mousse non tranchée", "Insert centré", "Surface lisse", "Tenue correcte au démoulage"]
  },
  {
    titre: "Glaçage miroir",
    categorie: "Finitions",
    temps: "30 min + repos",
    objectif: "Appliquer un glaçage brillant et régulier sur un entremets froid.",
    materiel: ["Casserole", "Mixeur plongeant", "Chinois", "Thermomètre", "Grille"],
    etapes: ["Cuire les éléments du glaçage.", "Ajouter gélatine et chocolat ou couverture.", "Mixer sans incorporer d'air.", "Utiliser à température adaptée.", "Couler sur entremets congelé."],
    controles: ["Pas de bulles", "Température d'utilisation correcte", "Entremets bien froid", "Couche fine et uniforme"]
  },
  {
    titre: "Tempérage du chocolat",
    categorie: "Chocolat",
    temps: "30 min",
    objectif: "Cristalliser correctement le chocolat pour obtenir brillance, cassant et démoulage net.",
    materiel: ["Thermomètre", "Spatule", "Cul-de-poule", "Marbre ou bain-marie", "Moules"],
    etapes: ["Fondre le chocolat.", "Refroidir selon la courbe adaptée.", "Remonter à température de travail.", "Maintenir la température.", "Mouler ou décorer."],
    controles: ["Courbe respectée", "Chocolat fluide", "Cristallisation rapide", "Aspect brillant sans traces blanches"]
  },
  {
    titre: "Décors chocolat",
    categorie: "Finitions",
    temps: "45 min",
    objectif: "Réaliser des décors fins, nets et brillants à partir de chocolat tempéré.",
    materiel: ["Rhodoïd", "Palette", "Corne", "Poche", "Thermomètre"],
    etapes: ["Tempérer le chocolat.", "Étaler ou pocher sur support.", "Pré-cristalliser.", "Détailler ou mettre en forme.", "Laisser cristalliser avant manipulation."],
    controles: ["Chocolat tempéré", "Épaisseur régulière", "Découpe au bon moment", "Décors brillants et cassants"]
  },
  {
    titre: "Caramel",
    categorie: "Finitions",
    temps: "20 min",
    objectif: "Cuire un sucre en caramel régulier pour décors, glaçage ou aromatisation.",
    materiel: ["Casserole", "Pinceau", "Spatule", "Thermomètre si besoin", "Plaque"],
    etapes: ["Cuire le sucre à sec ou avec eau selon méthode.", "Nettoyer les bords si besoin.", "Surveiller la coloration.", "Stopper ou décuire selon usage.", "Utiliser avec prudence."],
    controles: ["Coloration homogène", "Pas de cristallisation", "Pas d'amertume excessive", "Sécurité brûlure maîtrisée"]
  },
  {
    titre: "Praliné",
    categorie: "Chocolat",
    temps: "45 min",
    objectif: "Préparer une pâte pralinée à base de fruits secs caramélisés pour crèmes et garnitures.",
    materiel: ["Casserole", "Plaque", "Robot coupe", "Spatule", "Papier cuisson"],
    etapes: ["Torréfier les fruits secs.", "Réaliser un caramel.", "Enrober ou verser sur les fruits.", "Refroidir complètement.", "Mixer jusqu'à pâte lisse."],
    controles: ["Fruits secs torréfiés", "Caramel non brûlé", "Refroidissement complet", "Texture lisse et huileuse"]
  },
  {
    titre: "Hygiène HACCP CAP",
    categorie: "Examen",
    temps: "Toute production",
    objectif: "Appliquer les règles d'hygiène attendues en laboratoire et en situation d'examen.",
    materiel: ["Charlotte ou tenue", "Torchons propres", "Désinfectant", "Bacs", "Thermomètre"],
    etapes: ["Se laver les mains régulièrement.", "Séparer propre et sale.", "Protéger les denrées.", "Refroidir rapidement les préparations sensibles.", "Nettoyer et désinfecter le poste."],
    controles: ["Tenue propre", "Denrées filmées et datées si besoin", "Respect des températures", "Plan de travail propre"]
  },
  {
    titre: "Rétroplanning d'épreuve",
    categorie: "Examen",
    temps: "10 min au démarrage",
    objectif: "Organiser une production CAP en priorisant cuissons, repos, refroidissements et montages.",
    materiel: ["Sujet", "Stylo", "Planning", "Minuteur", "Balance"],
    etapes: ["Lire toutes les productions demandées.", "Repérer cuissons longues et temps froids.", "Classer les préparations par priorité.", "Prévoir les temps de nettoyage.", "Contrôler l'avancement régulièrement."],
    controles: ["Aucun oubli de production", "Temps froids anticipés", "Cuissons lancées tôt", "Finitions gardées en fin de planning"]
  },
  {
    titre: "Calcul coût matière",
    categorie: "Gestion",
    temps: "20 min",
    objectif: "Calculer le coût réel des ingrédients utilisés pour une recette ou une production.",
    materiel: ["Fiche recette", "Prix fournisseurs", "Calculatrice", "Balance"],
    etapes: ["Lister chaque ingrédient.", "Convertir les unités si nécessaire.", "Calculer le coût de la quantité utilisée.", "Additionner les coûts.", "Ajouter pertes ou marge selon l'objectif."],
    controles: ["Unités cohérentes", "Quantités exactes", "Prix au kilo ou au litre maîtrisés", "Résultat exploitable pour tarification"]
  }
);

fichesTechniques.sort((a, b) => a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" }));

const checklistItems = [
  { key: "theory", label: "Théorie lue" },
  { key: "sheet", label: "Fiche consultée" },
  { key: "recipe", label: "Recette testée" },
  { key: "note", label: "Note ajoutée" },
  { key: "coach", label: "Question posée au coach" }
];

const examProductions = [
  "Fond de tarte ou tartelettes",
  "Pâte à choux ou éclairs",
  "Crème de base",
  "Viennoiserie ou pâte levée",
  "Entremets ou montage",
  "Nettoyage et organisation finale"
];

const gestureSkills = ["Fonçage", "Pochage", "Tourage", "Crémage", "Cuisson", "Organisation"];

const frequentErrors = [
  { title: "Ma pâte à choux retombe", cause: "Panade pas assez desséchée, trop d'oeufs ou four ouvert trop tôt.", fix: "Dessécher jusqu'au film au fond de la casserole, ajouter les oeufs progressivement, cuire sans ouvrir au départ." },
  { title: "Crème pâtissière grainée", cause: "Cuisson trop forte, fouet insuffisant ou oeufs coagulés.", fix: "Fouetter sans arrêt, cuire à ébullition contrôlée, chinoiser si nécessaire et refroidir vite." },
  { title: "Fond de tarte détrempé", cause: "Fond pas assez cuit, garniture trop humide ou absence d'isolation.", fix: "Cuire à blanc plus longtemps, chablonner, garnir avec une crème froide et stable." },
  { title: "Feuilletage peu développé", cause: "Beurre trop chaud, tours irréguliers ou bords écrasés.", fix: "Respecter les repos au froid, abaisser régulièrement, détailler avec lame nette." },
  { title: "Ganache tranchée", cause: "Émulsion mal conduite ou écart de température trop fort.", fix: "Verser le liquide en plusieurs fois, mélanger au centre, mixer sans air." },
  { title: "Meringue qui retombe", cause: "Blancs trop peu serrés, sucre ajouté trop vite ou humidité.", fix: "Monter progressivement, serrer au sucre, utiliser rapidement et cuire/sécher correctement." },
  { title: "Brioche dense", cause: "Pétrissage insuffisant, beurre mal incorporé ou apprêt trop court.", fix: "Développer le réseau, incorporer le beurre progressivement, laisser pousser suffisamment." },
  { title: "Glaçage miroir terne", cause: "Mauvaise température, bulles ou entremets pas assez froid.", fix: "Mixer sans air, utiliser à température adaptée, glacer sur entremets congelé." }
];

const weeklyQuizQuestions = [
  { question: "Quel réflexe sécurise une production CAP ?", options: ["Lire tout le sujet avant de commencer", "Commencer par la recette préférée", "Attendre la fin pour nettoyer"], answer: 0 },
  { question: "Pourquoi filmer une crème au contact ?", options: ["Éviter la peau en surface", "La sucrer davantage", "La faire monter"], answer: 0 },
  { question: "Quand ajouter les oeufs dans une pâte à choux ?", options: ["Après desséchage de la panade", "Avant la farine", "Pendant l'ébullition"], answer: 0 },
  { question: "Quel signe indique une pâte trop travaillée ?", options: ["Elle devient élastique", "Elle devient froide", "Elle devient plus blanche"], answer: 0 },
  { question: "Quel geste limite les pertes de temps ?", options: ["Anticiper cuissons et refroidissements", "Tout faire dans l'ordre du sujet", "Nettoyer seulement à la fin"], answer: 0 }
];

function getTechnicalSheetSlug(title) {
  return normalizeSearchText(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getTechnicalSheetVisual(fiche) {
  return {
    label: fiche.categorie,
    className: "visual-custom"
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTechnicalSheetPalette(fiche) {
  const searchable = normalizeSearchText(`${fiche.titre} ${fiche.categorie}`);

  if (searchable.includes("chocolat") || searchable.includes("ganache") || searchable.includes("caramel") || searchable.includes("praline")) {
    return { main: "#6b3f2f", accent: "#f4c58a", bg: "#fff5e8" };
  }
  if (searchable.includes("examen") || searchable.includes("haccp") || searchable.includes("organisation") || searchable.includes("retroplanning") || searchable.includes("cout")) {
    return { main: "#4f6f62", accent: "#b5ead7", bg: "#f4fbf8" };
  }
  if (searchable.includes("feuillete") || searchable.includes("croissant") || searchable.includes("brioche") || searchable.includes("pain au chocolat") || searchable.includes("chausson") || searchable.includes("galette")) {
    return { main: "#a7652a", accent: "#ffd89c", bg: "#fff7ea" };
  }
  if (searchable.includes("creme") || searchable.includes("meringue")) {
    return { main: "#d68a75", accent: "#ffe0dc", bg: "#fff8f5" };
  }
  if (searchable.includes("biscuit") || searchable.includes("genoise") || searchable.includes("dacquoise") || searchable.includes("joconde")) {
    return { main: "#b88a3d", accent: "#ffe4aa", bg: "#fff8e9" };
  }
  if (searchable.includes("tarte") || searchable.includes("flan") || searchable.includes("fraisier") || searchable.includes("entremets")) {
    return { main: "#bd5f64", accent: "#ffccd0", bg: "#fff5f6" };
  }
  return { main: "#8f6c4f", accent: "#ffdac1", bg: "#fff7ef" };
}

function getTechnicalSheetDrawing(fiche, main, accent) {
  const searchable = normalizeSearchText(`${fiche.titre} ${fiche.categorie}`);

  if (searchable.includes("choux") || searchable.includes("eclair") || searchable.includes("religieuse") || searchable.includes("paris-brest")) {
    return `
      <path d="M72 160 C102 118 158 118 188 160 C214 124 276 124 304 160 C328 130 382 132 408 164 L408 244 L72 244 Z" fill="#f2b46b" stroke="${main}" stroke-width="5"/>
      <path d="M108 167 C134 147 164 147 184 169" fill="none" stroke="#fff3d9" stroke-width="8" stroke-linecap="round"/>
      <path d="M228 167 C254 147 284 147 304 169" fill="none" stroke="#fff3d9" stroke-width="8" stroke-linecap="round"/>
      <circle cx="150" cy="128" r="26" fill="#f4c078" stroke="${main}" stroke-width="5"/>
      <circle cx="250" cy="126" r="24" fill="#f4c078" stroke="${main}" stroke-width="5"/>
      <circle cx="340" cy="136" r="22" fill="#f4c078" stroke="${main}" stroke-width="5"/>`;
  }
  if (searchable.includes("croissant") || searchable.includes("pain au chocolat") || searchable.includes("brioche") || searchable.includes("feuillete") || searchable.includes("chausson") || searchable.includes("galette") || searchable.includes("mille-feuille")) {
    return `
      <path d="M102 184 C142 104 252 96 350 176 C302 164 270 186 242 216 C210 183 166 166 102 184 Z" fill="#f2b15e" stroke="${main}" stroke-width="6"/>
      <path d="M144 170 C182 144 226 142 264 166" fill="none" stroke="#fff1ca" stroke-width="8" stroke-linecap="round"/>
      <path d="M188 190 C222 166 270 166 314 192" fill="none" stroke="#d08335" stroke-width="5" stroke-linecap="round"/>
      <rect x="82" y="238" width="340" height="18" rx="9" fill="#d8a05b" opacity="0.55"/>`;
  }
  if (searchable.includes("creme") || searchable.includes("chantilly") || searchable.includes("meringue")) {
    return `
      <ellipse cx="240" cy="236" rx="132" ry="34" fill="#d9a285" opacity="0.35"/>
      <path d="M118 176 H362 L334 258 H146 Z" fill="#fff3ec" stroke="${main}" stroke-width="6"/>
      <path d="M162 170 C188 128 220 154 238 112 C260 154 294 126 320 170" fill="#ffffff" stroke="${main}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M326 82 L380 136" stroke="${main}" stroke-width="8" stroke-linecap="round"/>
      <path d="M342 118 L296 164" stroke="${main}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (searchable.includes("chocolat") || searchable.includes("ganache") || searchable.includes("temperage") || searchable.includes("decor") || searchable.includes("praline") || searchable.includes("caramel")) {
    return `
      <rect x="114" y="118" width="252" height="142" rx="18" fill="#7a4634" stroke="${main}" stroke-width="6"/>
      <path d="M178 118 V260 M240 118 V260 M302 118 V260 M114 166 H366 M114 214 H366" stroke="#a96a4f" stroke-width="4"/>
      <path d="M116 98 C168 70 226 108 278 82 C318 62 350 78 384 104" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="382" cy="106" r="13" fill="#f3ca8d"/>`;
  }
  if (searchable.includes("biscuit") || searchable.includes("genoise") || searchable.includes("dacquoise") || searchable.includes("joconde") || searchable.includes("financier") || searchable.includes("madeleine") || searchable.includes("cake")) {
    return `
      <rect x="104" y="142" width="272" height="114" rx="26" fill="#e7b56b" stroke="${main}" stroke-width="6"/>
      <path d="M132 168 H348" stroke="#fff0c8" stroke-width="8" stroke-linecap="round"/>
      <path d="M134 206 H346" stroke="#c9873d" stroke-width="5" stroke-linecap="round" opacity="0.65"/>
      <circle cx="172" cy="238" r="10" fill="#fff3d6"/><circle cx="230" cy="236" r="10" fill="#fff3d6"/><circle cx="288" cy="238" r="10" fill="#fff3d6"/>`;
  }
  if (searchable.includes("tarte") || searchable.includes("flan") || searchable.includes("bourdaloue") || searchable.includes("citron") || searchable.includes("fraisier") || searchable.includes("entremets")) {
    return `
      <ellipse cx="240" cy="230" rx="146" ry="42" fill="#d7975c" stroke="${main}" stroke-width="6"/>
      <ellipse cx="240" cy="218" rx="118" ry="32" fill="#fff0bd"/>
      <circle cx="190" cy="208" r="18" fill="#e75f6a"/><circle cx="236" cy="202" r="18" fill="#e75f6a"/><circle cx="282" cy="208" r="18" fill="#e75f6a"/>
      <path d="M170 234 C210 252 270 252 312 234" fill="none" stroke="#8f4f45" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (searchable.includes("haccp") || searchable.includes("organisation") || searchable.includes("retroplanning") || searchable.includes("cout") || searchable.includes("examen")) {
    return `
      <rect x="122" y="82" width="236" height="196" rx="22" fill="#ffffff" stroke="${main}" stroke-width="6"/>
      <path d="M166 136 H314 M166 178 H314 M166 220 H270" stroke="#7aa092" stroke-width="8" stroke-linecap="round"/>
      <path d="M144 134 L156 146 L178 120 M144 176 L156 188 L178 162" fill="none" stroke="#55a86f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="324" cy="238" r="32" fill="${accent}" stroke="${main}" stroke-width="5"/>`;
  }
  return `
      <path d="M120 238 C140 142 340 142 360 238 Z" fill="#efb273" stroke="${main}" stroke-width="6"/>
      <path d="M154 198 C194 166 286 166 326 198" fill="none" stroke="#fff1c9" stroke-width="8" stroke-linecap="round"/>
      <circle cx="198" cy="222" r="12" fill="#bd5f64"/><circle cx="240" cy="212" r="12" fill="#bd5f64"/><circle cx="282" cy="222" r="12" fill="#bd5f64"/>`;
}

function renderTechnicalSheetSvg(fiche) {
  const { main, accent, bg } = getTechnicalSheetPalette(fiche);
  const title = escapeHtml(fiche.titre);
  const category = escapeHtml(fiche.categorie);

  return `
    <svg class="technical-sheet-svg" viewBox="0 0 480 270" role="img" aria-label="Illustration technique pour ${title}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sheet-bg-${getTechnicalSheetSlug(fiche.titre)}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${bg}"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
      </defs>
      <rect width="480" height="270" fill="url(#sheet-bg-${getTechnicalSheetSlug(fiche.titre)})"/>
      <circle cx="66" cy="62" r="38" fill="#ffffff" opacity="0.45"/>
      <circle cx="414" cy="66" r="52" fill="#ffffff" opacity="0.28"/>
      ${getTechnicalSheetDrawing(fiche, main, accent)}
      <rect x="24" y="20" width="432" height="48" rx="18" fill="#ffffff" opacity="0.9"/>
      <text x="44" y="50" font-family="Outfit, Arial, sans-serif" font-size="21" font-weight="800" fill="#2d1d19">${title}</text>
      <rect x="24" y="214" width="190" height="34" rx="17" fill="#ffffff" opacity="0.92"/>
      <text x="42" y="237" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="${main}">${category}</text>
    </svg>
  `;
}

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  loadStateFromStorage();
  await fetchCurriculumData();
  await fetchProgrammeSessions();
  await initSupabaseClient();
  renderGlossaire(glossaire);
  renderFichesTechniques(fichesTechniques);
  setupNotesUI();
  renderNotes();
  renderRevisionPlanner();
  renderWeeklyChecklist();
  renderWeeklyQuiz();
  renderGlobalSearch("");
  renderFrequentErrors();
  renderExamMode();
  renderGestureEvaluations();
  
  if (state.contexte_eleve) {
    // Si l'élève a déjà configuré son profil, on affiche directement l'application
    document.getElementById("landingPageView").style.display = "none";
    document.getElementById("appWorkspaceView").style.display = "flex";
    disableLandingAudio();
    updateDashboardUI();
  }
});

// Fonctions de transition Landing -> App
function startFreeTrial() {
  // Fermer le lecteur audio pour ne pas gêner le formulaire (surtout sur mobile)
  disableLandingAudio();

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

  const supabaseAuthBtn = document.getElementById("supabaseAuthBtn");
  if (supabaseAuthBtn) {
    supabaseAuthBtn.addEventListener("click", handleSupabaseAuth);
  }

  const supabaseGoogleBtn = document.getElementById("supabaseGoogleBtn");
  if (supabaseGoogleBtn) {
    supabaseGoogleBtn.addEventListener("click", handleSupabaseGoogleAuth);
  }

  const supabaseSyncBtn = document.getElementById("supabaseSyncBtn");
  if (supabaseSyncBtn) {
    supabaseSyncBtn.addEventListener("click", syncLocalDataToSupabase);
  }

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
    disableLandingAudio();
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
    const query = normalizeSearchText(e.target.value.trim());
    const filtered = glossaire.filter(item => 
      normalizeSearchText(item.terme).includes(query) || 
      normalizeSearchText(item.definition).includes(query)
    );
    renderGlossaire(filtered);
  });

  const technicalSheetSearch = document.getElementById("technicalSheetSearch");
  if (technicalSheetSearch) {
    technicalSheetSearch.addEventListener("input", (e) => {
      const query = normalizeSearchText(e.target.value.trim());
      const filtered = fichesTechniques.filter(fiche =>
        normalizeSearchText(fiche.titre).includes(query) ||
        normalizeSearchText(fiche.categorie).includes(query) ||
        normalizeSearchText(fiche.objectif).includes(query) ||
        fiche.etapes.some(etape => normalizeSearchText(etape).includes(query)) ||
        fiche.controles.some(controle => normalizeSearchText(controle).includes(query))
      );
      renderFichesTechniques(filtered);
    });
  }

  const technicalSheetsGrid = document.getElementById("technicalSheetsGrid");
  if (technicalSheetsGrid) {
    technicalSheetsGrid.addEventListener("click", (e) => {
      const statusAction = e.target.closest("[data-sheet-status]");
      if (statusAction) {
        const title = statusAction.getAttribute("data-sheet-status");
        state.sheet_statuses[title] = statusAction.getAttribute("data-status-value");
        trackRecentItem("fiche", title, "fiches");
        saveStateToStorage();
        renderFichesTechniques(getCurrentFilteredSheets());
        renderTodayDashboard();
        return;
      }

      const favoriteAction = e.target.closest("[data-favorite-sheet]");
      if (favoriteAction) {
        toggleFavorite("fiches_favorites", favoriteAction.getAttribute("data-favorite-sheet"));
        renderFichesTechniques(getCurrentFilteredSheets());
        renderTodayDashboard();
        return;
      }

      const openAction = e.target.closest("[data-sheet-open]");
      if (openAction) {
        const title = openAction.getAttribute("data-sheet-open");
        trackRecentItem("fiche", title, "fiches");
        markChecklistItem(state.semaine_active || 1, "sheet", true);
        renderTodayDashboard();
        renderWeeklyChecklist();
        return;
      }

      const noteAction = e.target.closest("[data-sheet-note]");
      if (noteAction) {
        startNoteForSheet(noteAction.getAttribute("data-sheet-note"));
        return;
      }

      const printAction = e.target.closest("[data-sheet-print]");
      if (printAction) {
        printTechnicalSheet(printAction.getAttribute("data-sheet-print"));
        return;
      }

      const action = e.target.closest("[data-sheet-title]");
      if (!action) return;
      const title = action.getAttribute("data-sheet-title");
      trackRecentItem("fiche", title, "fiches");
      markChecklistItem(state.semaine_active || 1, "coach", true);
      switchTab("chat");
      sendMessageToCoach(`Explique-moi la fiche technique "${title}" avec les erreurs à éviter au CAP.`);
    });
  }

  const glossaryGrid = document.getElementById("glossaryGrid");
  if (glossaryGrid) {
    glossaryGrid.addEventListener("click", (e) => {
      const favoriteAction = e.target.closest("[data-favorite-glossary]");
      if (!favoriteAction) return;
      const term = favoriteAction.getAttribute("data-favorite-glossary");
      toggleFavorite("glossaire_favorites", term);
      trackRecentItem("glossaire", term, "glossaire");
      renderGlossaire(getCurrentFilteredGlossary());
      renderTodayDashboard();
    });
  }

  const noteForm = document.getElementById("noteForm");
  if (noteForm) {
    noteForm.addEventListener("submit", saveApprenticeNote);
  }

  ["notesSearchInput", "notesWeekFilter", "notesCategoryFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", renderNotes);
      el.addEventListener("change", renderNotes);
    }
  });

  const cancelNoteEditBtn = document.getElementById("cancelNoteEditBtn");
  if (cancelNoteEditBtn) {
    cancelNoteEditBtn.addEventListener("click", resetNoteForm);
  }

  const exportNotesBtn = document.getElementById("exportNotesBtn");
  if (exportNotesBtn) {
    exportNotesBtn.addEventListener("click", exportApprenticeNotes);
  }

  const notesList = document.getElementById("notesList");
  if (notesList) {
    notesList.addEventListener("click", handleNoteAction);
  }

  const exportGlobalDataBtn = document.getElementById("exportGlobalDataBtn");
  if (exportGlobalDataBtn) {
    exportGlobalDataBtn.addEventListener("click", exportGlobalData);
  }

  const importGlobalDataBtn = document.getElementById("importGlobalDataBtn");
  const importGlobalDataInput = document.getElementById("importGlobalDataInput");
  if (importGlobalDataBtn && importGlobalDataInput) {
    importGlobalDataBtn.addEventListener("click", () => importGlobalDataInput.click());
    importGlobalDataInput.addEventListener("change", importGlobalData);
  }

  const todayPanel = document.getElementById("todayPanel");
  if (todayPanel) {
    todayPanel.addEventListener("click", handleTodayAction);
  }

  const chatSessionPanel = document.getElementById("chatSessionPanel");
  if (chatSessionPanel) {
    chatSessionPanel.addEventListener("click", (e) => {
      const action = e.target.closest("[data-session-num]");
      if (!action) return;
      selectSession(parseInt(action.getAttribute("data-session-num"), 10) || 1);
    });
  }

  const weeklyChecklistPanel = document.getElementById("weeklyChecklistPanel");
  if (weeklyChecklistPanel) {
    weeklyChecklistPanel.addEventListener("change", handleChecklistChange);
  }

  const revisionPlannerPanel = document.getElementById("revisionPlannerPanel");
  if (revisionPlannerPanel) {
    revisionPlannerPanel.addEventListener("change", handleRevisionPlannerChange);
  }

  const weeklyQuizPanel = document.getElementById("weeklyQuizPanel");
  if (weeklyQuizPanel) {
    weeklyQuizPanel.addEventListener("click", handleQuizAction);
  }

  ["globalSearchInput", "globalSearchPageInput"].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", (e) => {
        const query = e.target.value;
        const pairedInput = id === "globalSearchInput" ? document.getElementById("globalSearchPageInput") : document.getElementById("globalSearchInput");
        if (pairedInput && pairedInput.value !== query) pairedInput.value = query;
        renderGlobalSearch(query);
        if (id === "globalSearchInput" && query.trim()) switchTab("recherche");
      });
    }
  });

  const errorSearchInput = document.getElementById("errorSearchInput");
  if (errorSearchInput) {
    errorSearchInput.addEventListener("input", () => renderFrequentErrors());
  }

  const examStartBtn = document.getElementById("examStartBtn");
  if (examStartBtn) examStartBtn.addEventListener("click", startExamTimer);
  const examPauseBtn = document.getElementById("examPauseBtn");
  if (examPauseBtn) examPauseBtn.addEventListener("click", pauseExamTimer);
  const examResetBtn = document.getElementById("examResetBtn");
  if (examResetBtn) examResetBtn.addEventListener("click", resetExamTimer);

  const examProductionsList = document.getElementById("examProductionsList");
  if (examProductionsList) examProductionsList.addEventListener("change", handleExamProductionChange);

  const gestureEvaluationGrid = document.getElementById("gestureEvaluationGrid");
  if (gestureEvaluationGrid) gestureEvaluationGrid.addEventListener("input", handleGestureEvaluationChange);

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
  const localStartedWeeks = localStorage.getItem("semaines_commencees");
  const localApprenticeNotes = localStorage.getItem("notes_apprenti");
  const localFavoriteSheets = localStorage.getItem("fiches_favorites");
  const localFavoriteGlossary = localStorage.getItem("glossaire_favorites");
  const localWeekChecklists = localStorage.getItem("week_checklists");
  const localSheetStatuses = localStorage.getItem("sheet_statuses");
  const localRecentItems = localStorage.getItem("recent_items");
  const localExamDate = localStorage.getItem("exam_date");
  const localExamMode = localStorage.getItem("exam_mode");
  const localGestureEvaluations = localStorage.getItem("gesture_evaluations");
  const localQuizResults = localStorage.getItem("quiz_results");
  const localLastAction = localStorage.getItem("last_action");
  const localActiveWeek = localStorage.getItem("semaine_active");
  const localActiveSession = localStorage.getItem("seance_active");
  const localActiveSessionsByWeek = localStorage.getItem("seances_actives_par_semaine");
  const localPremium = localStorage.getItem("is_premium");
  
  if (localContext) {
    state.contexte_eleve = JSON.parse(localContext);
  }
  if (localProgression) {
    state.progression = JSON.parse(localProgression);
  }
  if (localStartedWeeks) {
    state.semaines_commencees = JSON.parse(localStartedWeeks);
  }
  if (localApprenticeNotes) {
    state.notes_apprenti = JSON.parse(localApprenticeNotes);
  }
  if (localFavoriteSheets) {
    state.fiches_favorites = JSON.parse(localFavoriteSheets);
  }
  if (localFavoriteGlossary) {
    state.glossaire_favorites = JSON.parse(localFavoriteGlossary);
  }
  if (localWeekChecklists) {
    state.week_checklists = JSON.parse(localWeekChecklists);
  }
  if (localSheetStatuses) {
    state.sheet_statuses = JSON.parse(localSheetStatuses);
  }
  if (localRecentItems) {
    state.recent_items = JSON.parse(localRecentItems);
  }
  if (localExamDate) {
    state.exam_date = JSON.parse(localExamDate);
  }
  if (localExamMode) {
    state.exam_mode = { ...state.exam_mode, ...JSON.parse(localExamMode) };
  }
  if (localGestureEvaluations) {
    state.gesture_evaluations = JSON.parse(localGestureEvaluations);
  }
  if (localQuizResults) {
    state.quiz_results = JSON.parse(localQuizResults);
  }
  if (localLastAction) {
    state.last_action = JSON.parse(localLastAction);
  }
  if (localActiveWeek) {
    state.semaine_active = JSON.parse(localActiveWeek);
  }
  if (localActiveSession) {
    state.seance_active = JSON.parse(localActiveSession);
  }
  if (localActiveSessionsByWeek) {
    state.seances_actives_par_semaine = JSON.parse(localActiveSessionsByWeek);
  }
  if (localPremium) {
    state.is_premium = JSON.parse(localPremium);
  }
}

function saveStateToStorage() {
  localStorage.setItem("contexte_eleve", JSON.stringify(state.contexte_eleve));
  localStorage.setItem("progression", JSON.stringify(state.progression));
  localStorage.setItem("semaines_commencees", JSON.stringify(state.semaines_commencees));
  localStorage.setItem("notes_apprenti", JSON.stringify(state.notes_apprenti));
  localStorage.setItem("fiches_favorites", JSON.stringify(state.fiches_favorites));
  localStorage.setItem("glossaire_favorites", JSON.stringify(state.glossaire_favorites));
  localStorage.setItem("week_checklists", JSON.stringify(state.week_checklists));
  localStorage.setItem("sheet_statuses", JSON.stringify(state.sheet_statuses));
  localStorage.setItem("recent_items", JSON.stringify(state.recent_items));
  localStorage.setItem("exam_date", JSON.stringify(state.exam_date));
  localStorage.setItem("exam_mode", JSON.stringify(state.exam_mode));
  localStorage.setItem("gesture_evaluations", JSON.stringify(state.gesture_evaluations));
  localStorage.setItem("quiz_results", JSON.stringify(state.quiz_results));
  localStorage.setItem("last_action", JSON.stringify(state.last_action));
  localStorage.setItem("semaine_active", JSON.stringify(state.semaine_active));
  localStorage.setItem("seance_active", JSON.stringify(state.seance_active));
  localStorage.setItem("seances_actives_par_semaine", JSON.stringify(state.seances_actives_par_semaine));
  localStorage.setItem("is_premium", JSON.stringify(state.is_premium));
}

async function handleSupabaseAuth() {
  if (!isSupabaseConfigured()) {
    alert("Supabase n'est pas encore configure. Renseignez public/supabase-config.js avec l'URL du projet et la cle anon publique.");
    return;
  }

  if (!supabaseClient) {
    await initSupabaseClient();
  }

  if (supabaseUser) {
    await supabaseClient.auth.signOut();
    supabaseUser = null;
    localStorage.removeItem("supabase_last_user_id");
    updateSupabaseStatus();
    return;
  }

  const email = prompt("Email du compte apprenti :");
  if (!email) return;
  const password = prompt("Mot de passe :");
  if (!password) return;

  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    const shouldCreate = confirm("Connexion impossible. Voulez-vous creer ce compte avec cet email ?");
    if (!shouldCreate) return;
    ({ data, error } = await supabaseClient.auth.signUp({ email, password }));
  }

  if (error) {
    alert(`Connexion Supabase impossible : ${error.message}`);
    updateSupabaseStatus();
    return;
  }

  supabaseUser = data?.session?.user || null;
  updateSupabaseStatus();
  if (supabaseUser) {
    await handleSupabaseSessionReady(true);
    alert("Compte Supabase connecte. Vous pouvez synchroniser vos donnees.");
  } else {
    alert("Compte cree. Verifiez votre email si la confirmation est activee dans Supabase.");
  }
}

async function handleSupabaseSessionReady(forcePrompt = false) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const lastHandledUser = localStorage.getItem("supabase_last_user_id");
  if (!forcePrompt && lastHandledUser === userId) return;

  if (await hasSupabaseRemoteData()) {
    const shouldRestore = confirm("Des donnees existent deja sur Supabase. Voulez-vous les restaurer dans ce navigateur ?");
    if (shouldRestore) {
      await restoreSupabaseDataToLocal();
      localStorage.setItem("supabase_last_user_id", userId);
      alert("Donnees Supabase restaurees dans ce navigateur.");
      return;
    }
  }

  await upsertSupabaseProfile();
  localStorage.setItem("supabase_last_user_id", userId);
}

async function handleSupabaseGoogleAuth() {
  if (!isSupabaseConfigured()) {
    alert("Supabase n'est pas encore configure. Renseignez public/supabase-config.js.");
    return;
  }

  if (!supabaseClient) {
    await initSupabaseClient();
  }

  if (!supabaseClient) {
    alert("Client Supabase indisponible. Verifiez le chargement du SDK Supabase.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    alert(`Connexion Google impossible : ${error.message}`);
    updateSupabaseStatus();
  }
}

function getCurrentUserId() {
  return supabaseUser?.id || null;
}

async function upsertSupabaseProfile() {
  const userId = getCurrentUserId();
  if (!supabaseClient || !userId) return;

  const context = state.contexte_eleve || {};
  const { error } = await supabaseClient.from("profiles").upsert({
    user_id: userId,
    email: supabaseUser.email || null,
    level: context.niveau || null,
    oven_type: context.type_four || null,
    has_robot: Boolean(context.a_robot),
    exam_session: context.temps_disponible || null
  }, { onConflict: "user_id" });

  if (error) throw error;
}

function getTouchedWeeksForSync() {
  const weeks = new Set([
    ...(state.progression || []),
    ...(state.semaines_commencees || []),
    Number(state.semaine_active || 1)
  ]);
  Object.keys(state.week_checklists || {}).forEach(week => weeks.add(Number(week)));
  Object.keys(state.seances_actives_par_semaine || {}).forEach(week => weeks.add(Number(week)));
  (state.notes_apprenti || []).forEach(note => weeks.add(Number(note.week)));
  Object.keys(state.quiz_results || {}).forEach(week => weeks.add(Number(week)));
  return [...weeks].filter(week => Number.isFinite(week) && week >= 1 && week <= 56);
}

async function syncLocalDataToSupabase() {
  if (!isSupabaseConfigured()) {
    alert("Supabase n'est pas encore configure. Renseignez public/supabase-config.js.");
    return;
  }

  if (!supabaseClient || !supabaseUser) {
    alert("Connectez-vous d'abord a Supabase.");
    updateSupabaseStatus();
    return;
  }

  const syncBtn = document.getElementById("supabaseSyncBtn");
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = "Sync...";
  }

  try {
    await upsertSupabaseProfile();
    await syncProgressToSupabase();
    await syncChecklistsToSupabase();
    await syncNotesToSupabase();
    await syncFavoritesToSupabase();
    await syncSheetStatusesToSupabase();
    await syncQuizResultsToSupabase();
    await syncExamModeToSupabase();
    await syncRecentHistoryToSupabase();
    updateSupabaseStatus("Synchronise", "connected");
    setTimeout(() => updateSupabaseStatus(), 2200);
    alert("Synchronisation Supabase terminee.");
  } catch (error) {
    console.error("Supabase sync error:", error);
    alert(`Synchronisation impossible : ${error.message || error}`);
    updateSupabaseStatus();
  } finally {
    if (syncBtn) syncBtn.textContent = "Synchroniser";
    updateSupabaseStatus();
  }
}

async function syncProgressToSupabase() {
  const userId = getCurrentUserId();
  const now = new Date().toISOString();
  const rows = getTouchedWeeksForSync().map(week => {
    const completed = state.progression.includes(week);
    const started = completed || state.semaines_commencees.includes(week);
    return {
      user_id: userId,
      week_num: week,
      status: completed ? "completed" : (started ? "started" : "not_started"),
      active_session: state.seances_actives_par_semaine[week] || (week === state.semaine_active ? state.seance_active : 1),
      started_at: started ? now : null,
      completed_at: completed ? now : null
    };
  });
  if (!rows.length) return;
  const { error } = await supabaseClient.from("user_progress").upsert(rows, { onConflict: "user_id,week_num" });
  if (error) throw error;
}

async function syncChecklistsToSupabase() {
  const userId = getCurrentUserId();
  const rows = Object.entries(state.week_checklists || {}).map(([week, checklist]) => ({
    user_id: userId,
    week_num: Number(week),
    theory_read: Boolean(checklist.theory),
    sheet_viewed: Boolean(checklist.sheet),
    recipe_tested: Boolean(checklist.recipe),
    note_added: Boolean(checklist.note),
    coach_question: Boolean(checklist.coach)
  })).filter(row => Number.isFinite(row.week_num));
  if (!rows.length) return;
  const { error } = await supabaseClient.from("user_week_checklists").upsert(rows, { onConflict: "user_id,week_num" });
  if (error) throw error;
}

async function syncNotesToSupabase() {
  const userId = getCurrentUserId();
  const rows = (state.notes_apprenti || []).map(note => ({
    user_id: userId,
    local_id: note.id,
    week_num: Number(note.week) || null,
    session_num: state.seances_actives_par_semaine[note.week] || null,
    sheet_title: note.sheetTitle || null,
    category: note.category || null,
    title: note.title,
    content: note.content,
    created_at: note.createdAt || new Date().toISOString(),
    updated_at: note.updatedAt || note.createdAt || new Date().toISOString()
  })).filter(row => row.local_id && row.title && row.content);
  if (!rows.length) return;
  const { error } = await supabaseClient.from("user_notes").upsert(rows, { onConflict: "user_id,local_id" });
  if (error) throw error;
}

async function syncFavoritesToSupabase() {
  const userId = getCurrentUserId();
  const sheetRows = (state.fiches_favorites || []).map(title => ({
    user_id: userId,
    item_type: "technical_sheet",
    item_key: title,
    title
  }));
  const glossaryRows = (state.glossaire_favorites || []).map(title => ({
    user_id: userId,
    item_type: "glossary",
    item_key: title,
    title
  }));
  const rows = [...sheetRows, ...glossaryRows];
  if (!rows.length) return;
  const { error } = await supabaseClient.from("user_favorites").upsert(rows, { onConflict: "user_id,item_type,item_key" });
  if (error) throw error;
}

async function syncSheetStatusesToSupabase() {
  const userId = getCurrentUserId();
  const rows = Object.entries(state.sheet_statuses || {}).map(([sheetTitle, status]) => ({
    user_id: userId,
    sheet_title: sheetTitle,
    status
  })).filter(row => row.sheet_title && row.status);
  if (!rows.length) return;
  const { error } = await supabaseClient.from("user_sheet_statuses").upsert(rows, { onConflict: "user_id,sheet_title" });
  if (error) throw error;
}

async function syncQuizResultsToSupabase() {
  const userId = getCurrentUserId();
  const rows = Object.entries(state.quiz_results || {}).map(([week, result]) => ({
    user_id: userId,
    week_num: Number(week),
    score: Number(result.score || 0),
    total: Number(result.total || 0),
    answers: result.answers || {},
    completed_at: result.completedAt || new Date().toISOString()
  })).filter(row => Number.isFinite(row.week_num));
  if (!rows.length) return;
  const { error } = await supabaseClient.from("quiz_results").upsert(rows, { onConflict: "user_id,week_num" });
  if (error) throw error;
}

async function syncExamModeToSupabase() {
  const userId = getCurrentUserId();
  if (!state.exam_mode) return;
  const { error } = await supabaseClient.from("exam_sessions").upsert({
    user_id: userId,
    local_id: "local-current",
    title: "Examen blanc local",
    timer_seconds: Number(state.exam_mode.timerSeconds || 0),
    productions: state.exam_mode.productions || {},
    gesture_scores: state.exam_mode.scores || {}
  }, { onConflict: "user_id,local_id" });
  if (error) throw error;
}

async function syncRecentHistoryToSupabase() {
  const userId = getCurrentUserId();
  const rows = (state.recent_items || []).map(item => ({
    user_id: userId,
    item_type: item.type,
    title: item.title,
    target_tab: item.tabId,
    extra: item.extra || {},
    updated_at: item.updatedAt || new Date().toISOString()
  })).filter(row => row.item_type && row.title && row.target_tab);
  if (!rows.length) return;
  const { error } = await supabaseClient.from("recent_history").upsert(rows, { onConflict: "user_id,item_type,title" });
  if (error) throw error;
}

async function hasSupabaseRemoteData() {
  const userId = getCurrentUserId();
  if (!supabaseClient || !userId) return false;
  const { data, error } = await supabaseClient
    .from("user_progress")
    .select("week_num")
    .eq("user_id", userId)
    .limit(1);
  if (error) return false;
  return Boolean(data && data.length);
}

async function restoreSupabaseDataToLocal() {
  const userId = getCurrentUserId();
  if (!supabaseClient || !userId) return;

  const [
    profileRes,
    progressRes,
    checklistsRes,
    notesRes,
    favoritesRes,
    sheetStatusesRes,
    quizRes,
    examRes,
    recentRes
  ] = await Promise.all([
    supabaseClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabaseClient.from("user_progress").select("*").eq("user_id", userId),
    supabaseClient.from("user_week_checklists").select("*").eq("user_id", userId),
    supabaseClient.from("user_notes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    supabaseClient.from("user_favorites").select("*").eq("user_id", userId),
    supabaseClient.from("user_sheet_statuses").select("*").eq("user_id", userId),
    supabaseClient.from("quiz_results").select("*").eq("user_id", userId),
    supabaseClient.from("exam_sessions").select("*").eq("user_id", userId).eq("local_id", "local-current").maybeSingle(),
    supabaseClient.from("recent_history").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(12)
  ]);

  const firstError = [profileRes, progressRes, checklistsRes, notesRes, favoritesRes, sheetStatusesRes, quizRes, examRes, recentRes].find(result => result.error);
  if (firstError?.error) throw firstError.error;

  if (profileRes.data) {
    state.contexte_eleve = {
      niveau: profileRes.data.level || "débutant",
      type_four: profileRes.data.oven_type || "électrique",
      a_robot: Boolean(profileRes.data.has_robot),
      temps_disponible: profileRes.data.exam_session || "CAP Candidat Libre"
    };
  }

  state.progression = (progressRes.data || [])
    .filter(row => row.status === "completed")
    .map(row => row.week_num);
  state.semaines_commencees = (progressRes.data || [])
    .filter(row => row.status === "started" || row.status === "completed")
    .map(row => row.week_num);
  state.seances_actives_par_semaine = {};
  (progressRes.data || []).forEach(row => {
    state.seances_actives_par_semaine[row.week_num] = row.active_session || 1;
  });

  state.week_checklists = {};
  (checklistsRes.data || []).forEach(row => {
    state.week_checklists[row.week_num] = {
      theory: row.theory_read,
      sheet: row.sheet_viewed,
      recipe: row.recipe_tested,
      note: row.note_added,
      coach: row.coach_question
    };
  });

  state.notes_apprenti = (notesRes.data || []).map(row => ({
    id: row.local_id,
    week: row.week_num || 1,
    category: row.category || "Théorie",
    title: row.title,
    content: row.content,
    sheetTitle: row.sheet_title || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  state.fiches_favorites = (favoritesRes.data || [])
    .filter(row => row.item_type === "technical_sheet")
    .map(row => row.title);
  state.glossaire_favorites = (favoritesRes.data || [])
    .filter(row => row.item_type === "glossary")
    .map(row => row.title);

  state.sheet_statuses = {};
  (sheetStatusesRes.data || []).forEach(row => {
    state.sheet_statuses[row.sheet_title] = row.status;
  });

  state.quiz_results = {};
  (quizRes.data || []).forEach(row => {
    state.quiz_results[row.week_num] = {
      score: row.score,
      total: row.total,
      answers: row.answers || {},
      completedAt: row.completed_at
    };
  });

  if (examRes.data) {
    state.exam_mode = {
      ...state.exam_mode,
      timerSeconds: examRes.data.timer_seconds || 0,
      productions: examRes.data.productions || {},
      scores: examRes.data.gesture_scores || {}
    };
  }

  state.recent_items = (recentRes.data || []).map(row => ({
    type: row.item_type,
    title: row.title,
    tabId: row.target_tab,
    extra: row.extra || {},
    updatedAt: row.updated_at
  }));

  saveStateToStorage();
  updateDashboardUI();
  renderNotes();
  renderFichesTechniques(getCurrentFilteredSheets());
  renderGlossaire(getCurrentFilteredGlossary());
  renderWeeklyChecklist();
  renderWeeklyQuiz();
  renderExamMode();
  renderTodayDashboard();
}

function normalizeSearchText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function markWeekStarted(num) {
  if (!state.semaines_commencees.includes(num)) {
    state.semaines_commencees.push(num);
  }
}

// Sauvegarder l'historique de chat d'une seance dans localStorage
function saveChatHistory(weekNum, sessionNum = state.seance_active || 1) {
  const key = `chat_history_week_${weekNum}_session_${sessionNum}`;
  localStorage.setItem(key, JSON.stringify(state.historique_messages));
}

// Charger l'historique de chat d'une seance depuis localStorage
function loadChatHistory(weekNum, sessionNum = state.seance_active || 1) {
  const sessionKey = `chat_history_week_${weekNum}_session_${sessionNum}`;
  const legacyWeekKey = `chat_history_week_${weekNum}`;
  const saved = localStorage.getItem(sessionKey) || localStorage.getItem(legacyWeekKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getCurrentFilteredSheets() {
  const query = normalizeSearchText(document.getElementById("technicalSheetSearch")?.value.trim() || "");
  if (!query) return fichesTechniques;

  return fichesTechniques.filter(fiche =>
    normalizeSearchText(fiche.titre).includes(query) ||
    normalizeSearchText(fiche.categorie).includes(query) ||
    normalizeSearchText(fiche.objectif).includes(query) ||
    fiche.etapes.some(etape => normalizeSearchText(etape).includes(query)) ||
    fiche.controles.some(controle => normalizeSearchText(controle).includes(query))
  );
}

function getCurrentFilteredGlossary() {
  const query = normalizeSearchText(document.getElementById("glossarySearch")?.value.trim() || "");
  if (!query) return glossaire;

  return glossaire.filter(item =>
    normalizeSearchText(item.terme).includes(query) ||
    normalizeSearchText(item.definition).includes(query)
  );
}

function toggleFavorite(collectionName, value) {
  if (!value || !Array.isArray(state[collectionName])) return;

  if (state[collectionName].includes(value)) {
    state[collectionName] = state[collectionName].filter(item => item !== value);
  } else {
    state[collectionName].push(value);
  }
  saveStateToStorage();
}

function getAllCurriculumWeeks() {
  if (!state.curriculum) return [];
  return state.curriculum.blocs.flatMap(bloc => bloc.semaines);
}

function getWeekInfo(weekNum) {
  return getAllCurriculumWeeks().find(week => week.num === weekNum);
}

function getNextActionWeek() {
  const weeks = getAllCurriculumWeeks();
  return weeks.find(week => !state.progression.includes(week.num)) || weeks[weeks.length - 1] || { num: 1, titre: "Démarrer le parcours" };
}

function renderTodayDashboard() {
  const container = document.getElementById("todayPanel");
  if (!container || !state.curriculum) return;

  const weeks = getAllCurriculumWeeks();
  const nextWeek = getNextActionWeek();
  const recentNotes = [...state.notes_apprenti]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 2);
  const favoriteSheets = state.fiches_favorites.slice(0, 3);
  const favoriteTerms = state.glossaire_favorites.slice(0, 3);
  const recentItems = state.recent_items.slice(0, 4);
  const lastActionLabel = state.last_action ? `${state.last_action.type} - ${state.last_action.title}` : `Semaine ${nextWeek.num}`;
  const completedCount = state.progression.length;
  const startedCount = state.semaines_commencees.length;
  const totalWeeks = weeks.length || 56;

  container.innerHTML = `
    <div class="today-header">
      <div>
        <span class="today-kicker">Aujourd'hui</span>
        <h3>Semaine ${nextWeek.num} - ${escapeHtml(nextWeek.titre)}</h3>
        <p>${completedCount} semaine${completedCount > 1 ? "s" : ""} terminée${completedCount > 1 ? "s" : ""}, ${startedCount} commencée${startedCount > 1 ? "s" : ""} sur ${totalWeeks}. Dernière action : ${escapeHtml(lastActionLabel)}.</p>
      </div>
      <div class="today-actions">
        <button type="button" data-today-action="resume">Reprendre</button>
        <button type="button" data-today-action="add-note" data-week="${nextWeek.num}">Ajouter une note</button>
      </div>
    </div>
    <div class="today-grid">
      <div class="today-card">
        <h4>Prochaine action</h4>
        <p>Travaillez la semaine ${nextWeek.num}, puis notez l'erreur ou le geste à reprendre.</p>
      </div>
      <div class="today-card">
        <h4>Notes récentes</h4>
        ${recentNotes.length ? recentNotes.map(note => `
          <button type="button" class="today-link" data-today-action="edit-note" data-note-id="${note.id}">
            S${note.week} - ${escapeHtml(note.title)}
          </button>
        `).join("") : `<p>Aucune note récente.</p>`}
      </div>
      <div class="today-card">
        <h4>Fiches favorites</h4>
        ${favoriteSheets.length ? favoriteSheets.map(title => `
          <button type="button" class="today-link" data-today-action="open-fiches" data-search="${escapeHtml(title)}">${escapeHtml(title)}</button>
        `).join("") : `<p>Ajoutez une étoile sur vos fiches importantes.</p>`}
      </div>
      <div class="today-card">
        <h4>Glossaire favori</h4>
        ${favoriteTerms.length ? favoriteTerms.map(term => `
          <button type="button" class="today-link" data-today-action="open-glossaire" data-search="${escapeHtml(term)}">${escapeHtml(term)}</button>
        `).join("") : `<p>Marquez les termes à revoir.</p>`}
      </div>
      <div class="today-card">
        <h4>Historique récent</h4>
        ${recentItems.length ? recentItems.map(item => `
          <button type="button" class="today-link" data-today-action="recent-item" data-recent-type="${item.type}" data-recent-title="${escapeHtml(item.title)}" data-recent-week="${item.extra?.week || ""}" data-recent-session="${item.extra?.session || ""}">
            ${escapeHtml(item.type)} - ${escapeHtml(item.title)}
          </button>
        `).join("") : `<p>Aucune action récente.</p>`}
      </div>
    </div>
  `;
}

function handleTodayAction(e) {
  const action = e.target.closest("[data-today-action]");
  if (!action) return;

  const type = action.getAttribute("data-today-action");
  if (type === "resume") {
    resumeLastAction();
    return;
  }

  if (type === "open-week") {
    selectWeek(parseInt(action.getAttribute("data-week"), 10));
    return;
  }

  if (type === "add-note") {
    switchTab("notes");
    const weekSelect = document.getElementById("noteWeekSelect");
    if (weekSelect) weekSelect.value = action.getAttribute("data-week") || String(state.semaine_active || 1);
    document.getElementById("noteTitleInput")?.focus();
    return;
  }

  if (type === "edit-note") {
    const noteId = action.getAttribute("data-note-id");
    const note = state.notes_apprenti.find(item => item.id === noteId);
    if (!note) return;
    switchTab("notes");
    document.getElementById("noteEditingId").value = note.id;
    document.getElementById("noteWeekSelect").value = String(note.week);
    document.getElementById("noteCategorySelect").value = note.category;
    document.getElementById("noteTitleInput").value = note.title;
    document.getElementById("noteContentInput").value = note.content;
    document.getElementById("noteSheetTitleInput").value = note.sheetTitle || "";
    const linkedSheet = document.getElementById("noteLinkedSheet");
    if (linkedSheet) {
      linkedSheet.style.display = note.sheetTitle ? "block" : "none";
      linkedSheet.innerText = note.sheetTitle ? `Note liée à la fiche : ${note.sheetTitle}` : "";
    }
    document.querySelector(".note-editor-header h3").innerText = "Modifier la note";
    document.getElementById("cancelNoteEditBtn").style.display = "inline-flex";
    document.getElementById("noteTitleInput").focus();
    return;
  }

  if (type === "open-fiches") {
    switchTab("fiches");
    const input = document.getElementById("technicalSheetSearch");
    if (input) {
      input.value = action.getAttribute("data-search") || "";
      renderFichesTechniques(getCurrentFilteredSheets());
    }
    return;
  }

  if (type === "open-glossaire") {
    switchTab("glossaire");
    const input = document.getElementById("glossarySearch");
    if (input) {
      input.value = action.getAttribute("data-search") || "";
      renderGlossaire(getCurrentFilteredGlossary());
    }
    return;
  }

  if (type === "recent-item") {
    const recentType = action.getAttribute("data-recent-type");
    const title = action.getAttribute("data-recent-title");
    if (recentType === "fiche") {
      switchTab("fiches");
      document.getElementById("technicalSheetSearch").value = title;
      renderFichesTechniques(getCurrentFilteredSheets());
      return;
    }
    if (recentType === "glossaire") {
      switchTab("glossaire");
      document.getElementById("glossarySearch").value = title;
      renderGlossaire(getCurrentFilteredGlossary());
      return;
    }
    if (recentType === "week") {
      const week = parseInt(action.getAttribute("data-recent-week"), 10) || state.semaine_active || 1;
      const session = parseInt(action.getAttribute("data-recent-session"), 10);
      selectWeek(week);
      if (session) selectSession(session);
    }
  }
}

function exportGlobalData() {
  const chatHistory = {};
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("chat_history_week_")) {
      chatHistory[key] = JSON.parse(localStorage.getItem(key) || "[]");
    }
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    contexte_eleve: state.contexte_eleve,
    progression: state.progression,
    semaines_commencees: state.semaines_commencees,
    notes_apprenti: state.notes_apprenti,
    fiches_favorites: state.fiches_favorites,
    glossaire_favorites: state.glossaire_favorites,
    week_checklists: state.week_checklists,
    sheet_statuses: state.sheet_statuses,
    recent_items: state.recent_items,
    exam_date: state.exam_date,
    exam_mode: state.exam_mode,
    gesture_evaluations: state.gesture_evaluations,
    quiz_results: state.quiz_results,
    last_action: state.last_action,
    semaine_active: state.semaine_active,
    seance_active: state.seance_active,
    seances_actives_par_semaine: state.seances_actives_par_semaine,
    is_premium: state.is_premium,
    chat_history: chatHistory
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sauvegarde-cap-patissier.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importGlobalData(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const keys = [
        "contexte_eleve", "progression", "semaines_commencees", "notes_apprenti",
        "fiches_favorites", "glossaire_favorites", "week_checklists", "sheet_statuses",
        "recent_items", "exam_date", "exam_mode", "gesture_evaluations", "quiz_results",
        "last_action", "semaine_active", "seance_active", "seances_actives_par_semaine", "is_premium"
      ];

      keys.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
      });

      if (data.chat_history && typeof data.chat_history === "object") {
        Object.entries(data.chat_history).forEach(([key, value]) => {
          if (key.startsWith("chat_history_week_")) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
      }

      alert("Sauvegarde importée. L'application va se recharger.");
      location.reload();
    } catch (error) {
      alert("Import impossible : le fichier n'est pas une sauvegarde valide.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function trackRecentItem(type, title, tabId, extra = {}) {
  if (!title) return;
  const item = { type, title, tabId, extra, updatedAt: new Date().toISOString() };
  state.recent_items = [
    item,
    ...state.recent_items.filter(existing => !(existing.type === type && existing.title === title))
  ].slice(0, 12);
  state.last_action = item;
  saveStateToStorage();
  renderTodayDashboard();
}

function resumeLastAction() {
  const action = state.last_action;
  if (!action) {
    const nextWeek = getNextActionWeek();
    selectWeek(nextWeek.num);
    return;
  }

  if (action.type === "fiche") {
    switchTab("fiches");
    const input = document.getElementById("technicalSheetSearch");
    if (input) input.value = action.title;
    renderFichesTechniques(getCurrentFilteredSheets());
    return;
  }
  if (action.type === "note") {
    switchTab("notes");
    renderNotes();
    return;
  }
  if (action.type === "glossaire") {
    switchTab("glossaire");
    const input = document.getElementById("glossarySearch");
    if (input) input.value = action.title;
    renderGlossaire(getCurrentFilteredGlossary());
    return;
  }
  if (action.type === "week") {
    selectWeek(action.extra?.week || state.semaine_active || 1);
  }
}

function getChecklistForWeek(week) {
  if (!state.week_checklists[week]) {
    state.week_checklists[week] = {};
  }
  return state.week_checklists[week];
}

function markChecklistItem(week, key, value) {
  const checklist = getChecklistForWeek(week);
  checklist[key] = value;
  saveStateToStorage();
}

function renderWeeklyChecklist() {
  const container = document.getElementById("weeklyChecklistPanel");
  if (!container) return;
  const week = state.semaine_active || getNextActionWeek().num || 1;
  const checklist = getChecklistForWeek(week);
  const completed = checklistItems.filter(item => checklist[item.key]).length;

  container.innerHTML = `
    <div class="tool-card-header">
      <h3>Checklist semaine ${week}</h3>
      <span>${completed}/${checklistItems.length}</span>
    </div>
    <div class="checklist-items">
      ${checklistItems.map(item => `
        <label class="checklist-item">
          <input type="checkbox" data-checklist-week="${week}" data-checklist-key="${item.key}" ${checklist[item.key] ? "checked" : ""}>
          <span>${item.label}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function handleChecklistChange(e) {
  const input = e.target.closest("[data-checklist-key]");
  if (!input) return;
  const week = input.getAttribute("data-checklist-week");
  const key = input.getAttribute("data-checklist-key");
  const checklist = getChecklistForWeek(week);
  checklist[key] = input.checked;
  if (input.checked) markWeekStarted(parseInt(week, 10));
  saveStateToStorage();
  renderWeeklyChecklist();
  renderTodayDashboard();
  updateDashboardUI();
}

function renderRevisionPlanner() {
  const container = document.getElementById("revisionPlannerPanel");
  if (!container) return;

  const today = new Date();
  const examDate = state.exam_date ? new Date(state.exam_date) : null;
  const daysLeft = examDate ? Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)) : null;
  const weeksLeft = daysLeft !== null ? Math.max(1, Math.ceil(daysLeft / 7)) : null;
  const remainingWeeks = getAllCurriculumWeeks().filter(week => !state.progression.includes(week.num)).length || 1;
  const rhythm = weeksLeft ? Math.max(1, Math.ceil(remainingWeeks / weeksLeft)) : null;

  container.innerHTML = `
    <div class="tool-card-header">
      <h3>Planning de révision</h3>
      <span>${state.exam_date ? `${daysLeft} j` : "À définir"}</span>
    </div>
    <label class="planner-date">
      <span>Date d'examen</span>
      <input type="date" id="examDateInput" value="${state.exam_date || ""}">
    </label>
    <p>${state.exam_date ? `Il reste ${weeksLeft} semaine${weeksLeft > 1 ? "s" : ""}. Visez ${rhythm} semaine${rhythm > 1 ? "s" : ""} de programme par semaine.` : "Choisissez une date pour calculer un rythme de révision."}</p>
  `;
}

function handleRevisionPlannerChange(e) {
  if (e.target.id !== "examDateInput") return;
  state.exam_date = e.target.value;
  saveStateToStorage();
  renderRevisionPlanner();
  renderTodayDashboard();
}

function renderWeeklyQuiz() {
  const container = document.getElementById("weeklyQuizPanel");
  if (!container) return;
  const week = state.semaine_active || 1;
  const result = state.quiz_results[week];

  container.innerHTML = `
    <div class="tool-card-header">
      <h3>Quiz semaine ${week}</h3>
      <span>${result ? `${result.score}/5` : "5 questions"}</span>
    </div>
    <p>${result ? "Quiz déjà tenté. Vous pouvez le refaire pour valider vos acquis." : "Validez rapidement les réflexes de la semaine."}</p>
    <button type="button" class="tool-primary-btn" data-quiz-action="start" data-week="${week}">${result ? "Refaire le quiz" : "Lancer le quiz"}</button>
    <div class="quiz-container" id="quizContainer"></div>
  `;
}

function handleQuizAction(e) {
  const action = e.target.closest("[data-quiz-action]");
  if (!action) return;
  const type = action.getAttribute("data-quiz-action");
  const week = parseInt(action.getAttribute("data-week"), 10) || state.semaine_active || 1;
  const container = document.getElementById("quizContainer");
  if (!container) return;

  if (type === "start") {
    container.innerHTML = weeklyQuizQuestions.map((question, index) => `
      <fieldset class="quiz-question">
        <legend>${index + 1}. ${question.question}</legend>
        ${question.options.map((option, optionIndex) => `
          <label>
            <input type="radio" name="quiz_${index}" value="${optionIndex}">
            <span>${option}</span>
          </label>
        `).join("")}
      </fieldset>
    `).join("") + `<button type="button" class="tool-primary-btn" data-quiz-action="submit" data-week="${week}">Valider</button>`;
    return;
  }

  if (type === "submit") {
    const score = weeklyQuizQuestions.reduce((total, question, index) => {
      const selected = document.querySelector(`input[name="quiz_${index}"]:checked`);
      return total + (selected && parseInt(selected.value, 10) === question.answer ? 1 : 0);
    }, 0);
    state.quiz_results[week] = { score, completedAt: new Date().toISOString() };
    saveStateToStorage();
    container.innerHTML = `<div class="quiz-result">Score : ${score}/5. ${score >= 4 ? "Acquis solides." : "À revoir avec le coach ou les fiches."}</div>`;
    renderTodayDashboard();
  }
}

let examTimerInterval = null;

function formatTimer(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function renderExamTimer() {
  const display = document.getElementById("examTimerDisplay");
  if (display) display.innerText = formatTimer(state.exam_mode.timerSeconds || 0);
}

function startExamTimer() {
  if (examTimerInterval) return;
  examTimerInterval = setInterval(() => {
    state.exam_mode.timerSeconds += 1;
    renderExamTimer();
    localStorage.setItem("exam_mode", JSON.stringify(state.exam_mode));
  }, 1000);
}

function pauseExamTimer() {
  if (examTimerInterval) {
    clearInterval(examTimerInterval);
    examTimerInterval = null;
  }
  saveStateToStorage();
}

function resetExamTimer() {
  pauseExamTimer();
  state.exam_mode.timerSeconds = 0;
  saveStateToStorage();
  renderExamTimer();
}

function renderExamMode() {
  renderExamTimer();
  const list = document.getElementById("examProductionsList");
  if (!list) return;
  list.innerHTML = examProductions.map(item => `
    <label class="exam-production">
      <input type="checkbox" data-exam-production="${item}" ${state.exam_mode.productions[item] ? "checked" : ""}>
      <span>${item}</span>
    </label>
  `).join("");
}

function handleExamProductionChange(e) {
  const input = e.target.closest("[data-exam-production]");
  if (!input) return;
  state.exam_mode.productions[input.getAttribute("data-exam-production")] = input.checked;
  saveStateToStorage();
}

function renderGestureEvaluations() {
  const container = document.getElementById("gestureEvaluationGrid");
  if (!container) return;
  container.innerHTML = gestureSkills.map(skill => {
    const value = state.gesture_evaluations[skill] || 0;
    return `
      <label class="gesture-row">
        <span>${skill}</span>
        <input type="range" min="0" max="5" value="${value}" data-gesture="${skill}">
        <strong>${value}/5</strong>
      </label>
    `;
  }).join("");
}

function handleGestureEvaluationChange(e) {
  const input = e.target.closest("[data-gesture]");
  if (!input) return;
  state.gesture_evaluations[input.getAttribute("data-gesture")] = parseInt(input.value, 10);
  saveStateToStorage();
  renderGestureEvaluations();
}

function renderFrequentErrors() {
  const container = document.getElementById("errorGrid");
  if (!container) return;
  const query = normalizeSearchText(document.getElementById("errorSearchInput")?.value.trim() || "");
  const list = frequentErrors.filter(error => !query ||
    normalizeSearchText(error.title).includes(query) ||
    normalizeSearchText(error.cause).includes(query) ||
    normalizeSearchText(error.fix).includes(query)
  );

  container.innerHTML = list.map(error => `
    <article class="error-card">
      <h3>${error.title}</h3>
      <p><strong>Cause probable :</strong> ${error.cause}</p>
      <p><strong>Correction :</strong> ${error.fix}</p>
      <button type="button" data-error-coach="${escapeHtml(error.title)}">Demander au coach</button>
    </article>
  `).join("");

  container.querySelectorAll("[data-error-coach]").forEach(button => {
    button.addEventListener("click", () => {
      switchTab("chat");
      sendMessageToCoach(`J'ai ce problème : ${button.getAttribute("data-error-coach")}. Peux-tu m'aider à diagnostiquer et corriger ?`);
    });
  });
}

function buildGlobalSearchResults(query) {
  const normalized = normalizeSearchText(query.trim());
  if (!normalized) return [];
  const results = [];

  getAllCurriculumWeeks().forEach(week => {
    if (normalizeSearchText(`semaine ${week.num} ${week.titre}`).includes(normalized)) {
      results.push({ type: "Semaine", title: `Semaine ${week.num}`, detail: week.titre, action: "week", value: week.num });
    }
  });
  fichesTechniques.forEach(fiche => {
    if (normalizeSearchText(`${fiche.titre} ${fiche.categorie} ${fiche.objectif}`).includes(normalized)) {
      results.push({ type: "Fiche", title: fiche.titre, detail: fiche.categorie, action: "fiches", value: fiche.titre });
    }
  });
  glossaire.forEach(item => {
    if (normalizeSearchText(`${item.terme} ${item.definition}`).includes(normalized)) {
      results.push({ type: "Glossaire", title: item.terme, detail: item.definition, action: "glossaire", value: item.terme });
    }
  });
  state.notes_apprenti.forEach(note => {
    if (normalizeSearchText(`${note.title} ${note.content} ${note.category}`).includes(normalized)) {
      results.push({ type: "Note", title: note.title, detail: `Semaine ${note.week} - ${note.category}`, action: "note", value: note.id });
    }
  });

  return results.slice(0, 30);
}

function renderGlobalSearch(query) {
  const container = document.getElementById("globalSearchResults");
  if (!container) return;
  const results = buildGlobalSearchResults(query);
  if (!query.trim()) {
    container.innerHTML = `<div class="search-empty">Tapez un mot-clé pour chercher dans toute l'application.</div>`;
    return;
  }
  if (!results.length) {
    container.innerHTML = `<div class="search-empty">Aucun résultat trouvé.</div>`;
    return;
  }
  container.innerHTML = results.map(result => `
    <button type="button" class="global-result" data-global-action="${result.action}" data-global-value="${escapeHtml(result.value)}">
      <span>${result.type}</span>
      <strong>${escapeHtml(result.title)}</strong>
      <small>${escapeHtml(result.detail)}</small>
    </button>
  `).join("");
  container.querySelectorAll("[data-global-action]").forEach(button => {
    button.addEventListener("click", () => openGlobalResult(button.getAttribute("data-global-action"), button.getAttribute("data-global-value")));
  });
}

function openGlobalResult(action, value) {
  if (action === "week") {
    selectWeek(parseInt(value, 10));
    return;
  }
  if (action === "fiches") {
    switchTab("fiches");
    document.getElementById("technicalSheetSearch").value = value;
    renderFichesTechniques(getCurrentFilteredSheets());
    return;
  }
  if (action === "glossaire") {
    switchTab("glossaire");
    document.getElementById("glossarySearch").value = value;
    renderGlossaire(getCurrentFilteredGlossary());
    return;
  }
  if (action === "note") {
    switchTab("notes");
    renderNotes();
  }
}

function setupNotesUI() {
  const weekSelect = document.getElementById("noteWeekSelect");
  const weekFilter = document.getElementById("notesWeekFilter");

  if (weekSelect) {
    weekSelect.innerHTML = Array.from({ length: 56 }, (_, index) => {
      const week = index + 1;
      return `<option value="${week}" ${week === state.semaine_active ? "selected" : ""}>Semaine ${week}</option>`;
    }).join("");
  }

  if (weekFilter) {
    weekFilter.innerHTML = `
      <option value="all">Toutes les semaines</option>
      ${Array.from({ length: 56 }, (_, index) => {
        const week = index + 1;
        return `<option value="${week}">Semaine ${week}</option>`;
      }).join("")}
    `;
  }
}

function saveApprenticeNote(e) {
  e.preventDefault();

  const editingId = document.getElementById("noteEditingId").value;
  const sheetTitle = document.getElementById("noteSheetTitleInput")?.value || "";
  const selectedWeek = parseInt(document.getElementById("noteWeekSelect").value, 10);
  const week = Number.isFinite(selectedWeek) ? selectedWeek : (state.semaine_active || 1);
  const category = document.getElementById("noteCategorySelect").value || "Théorie";
  const title = document.getElementById("noteTitleInput").value.trim();
  const content = document.getElementById("noteContentInput").value.trim();

  if (!title || !content) return;

  const now = new Date().toISOString();
  if (editingId) {
    state.notes_apprenti = state.notes_apprenti.map(note => (
      note.id === editingId
        ? { ...note, week, category, title, content, sheetTitle, updatedAt: now }
        : note
    ));
  } else {
    state.notes_apprenti.unshift({
      id: `note_${Date.now()}`,
      week,
      category,
      title,
      content,
      sheetTitle,
      createdAt: now,
      updatedAt: now
    });
    markWeekStarted(week);
    markChecklistItem(week, "note", true);
  }

  saveStateToStorage();
  trackRecentItem("note", title, "notes", { noteId: editingId || state.notes_apprenti[0]?.id, week });
  resetNoteForm();
  renderNotes();
  renderTodayDashboard();
  updateDashboardUI();
}

function resetNoteForm() {
  const form = document.getElementById("noteForm");
  if (form) form.reset();

  const editingId = document.getElementById("noteEditingId");
  if (editingId) editingId.value = "";

  const sheetInput = document.getElementById("noteSheetTitleInput");
  if (sheetInput) sheetInput.value = "";

  const linkedSheet = document.getElementById("noteLinkedSheet");
  if (linkedSheet) {
    linkedSheet.style.display = "none";
    linkedSheet.innerText = "";
  }

  const weekSelect = document.getElementById("noteWeekSelect");
  if (weekSelect) weekSelect.value = String(state.semaine_active || 1);

  const header = document.querySelector(".note-editor-header h3");
  if (header) header.innerText = "Nouvelle note";

  const cancelBtn = document.getElementById("cancelNoteEditBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
}

function startNoteForSheet(sheetTitle) {
  switchTab("notes");
  resetNoteForm();
  const sheetInput = document.getElementById("noteSheetTitleInput");
  if (sheetInput) sheetInput.value = sheetTitle;
  const linkedSheet = document.getElementById("noteLinkedSheet");
  if (linkedSheet) {
    linkedSheet.style.display = "block";
    linkedSheet.innerText = `Note liée à la fiche : ${sheetTitle}`;
  }
  document.getElementById("noteCategorySelect").value = "Recette";
  document.getElementById("noteTitleInput").value = `À propos de ${sheetTitle}`;
  document.getElementById("noteContentInput").focus();
  trackRecentItem("fiche", sheetTitle, "fiches");
}

function getFilteredNotes() {
  const query = normalizeSearchText(document.getElementById("notesSearchInput")?.value.trim() || "");
  const weekFilter = document.getElementById("notesWeekFilter")?.value || "all";
  const categoryFilter = document.getElementById("notesCategoryFilter")?.value || "all";

  return state.notes_apprenti.filter(note => {
    const matchesQuery = !query ||
      normalizeSearchText(note.title).includes(query) ||
      normalizeSearchText(note.content).includes(query) ||
      normalizeSearchText(note.category).includes(query);
    const matchesWeek = weekFilter === "all" || String(note.week) === weekFilter;
    const matchesCategory = categoryFilter === "all" || note.category === categoryFilter;
    return matchesQuery && matchesWeek && matchesCategory;
  });
}

function formatNoteDate(value) {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch (error) {
    return "";
  }
}

function renderNotes() {
  const container = document.getElementById("notesList");
  if (!container) return;

  const notes = getFilteredNotes();
  if (!notes.length) {
    container.innerHTML = `
      <div class="notes-empty-state">
        <h3>Aucune note pour le moment</h3>
        <p>Ajoutez une première observation : une erreur à corriger, une astuce, ou une question à poser au coach.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notes.map(note => `
    <article class="note-card" data-note-id="${note.id}">
      <div class="note-card-header">
        <span class="note-week-badge">Semaine ${note.week}</span>
        <span class="note-category-badge">${note.category}</span>
      </div>
      <h3>${escapeHtml(note.title)}</h3>
      ${note.sheetTitle ? `<div class="note-linked-badge">Fiche : ${escapeHtml(note.sheetTitle)}</div>` : ""}
      <p>${escapeHtml(note.content).replace(/\n/g, "<br>")}</p>
      <div class="note-meta">Modifiée le ${formatNoteDate(note.updatedAt || note.createdAt)}</div>
      <div class="note-actions">
        <button type="button" data-note-action="coach">Demander au coach</button>
        <button type="button" data-note-action="edit">Modifier</button>
        <button type="button" data-note-action="print">Imprimer</button>
        <button type="button" data-note-action="delete">Supprimer</button>
      </div>
    </article>
  `).join("");
}

function handleNoteAction(e) {
  const button = e.target.closest("[data-note-action]");
  if (!button) return;

  const card = button.closest("[data-note-id]");
  const note = state.notes_apprenti.find(item => item.id === card?.getAttribute("data-note-id"));
  if (!note) return;

  const action = button.getAttribute("data-note-action");
  if (action === "edit") {
    document.getElementById("noteEditingId").value = note.id;
    document.getElementById("noteWeekSelect").value = String(note.week);
    document.getElementById("noteCategorySelect").value = note.category;
    document.getElementById("noteTitleInput").value = note.title;
    document.getElementById("noteContentInput").value = note.content;
    document.getElementById("noteSheetTitleInput").value = note.sheetTitle || "";
    const linkedSheet = document.getElementById("noteLinkedSheet");
    if (linkedSheet) {
      linkedSheet.style.display = note.sheetTitle ? "block" : "none";
      linkedSheet.innerText = note.sheetTitle ? `Note liée à la fiche : ${note.sheetTitle}` : "";
    }
    document.querySelector(".note-editor-header h3").innerText = "Modifier la note";
    document.getElementById("cancelNoteEditBtn").style.display = "inline-flex";
    document.getElementById("noteTitleInput").focus();
    return;
  }

  if (action === "delete") {
    if (!confirm("Supprimer cette note ?")) return;
    state.notes_apprenti = state.notes_apprenti.filter(item => item.id !== note.id);
    saveStateToStorage();
    renderNotes();
    renderTodayDashboard();
    return;
  }

  if (action === "print") {
    printNote(note);
    return;
  }

  if (action === "coach") {
    state.semaine_active = note.week;
    switchTab("chat");
    sendMessageToCoach(`Voici ma note de la semaine ${note.week} (${note.category}) : "${note.title}"\n\n${note.content}\n\nPeux-tu m'aider à l'analyser et me dire quoi travailler ensuite ?`);
  }
}

function exportApprenticeNotes() {
  const lines = state.notes_apprenti.map(note => [
    `# ${note.title}`,
    `Semaine ${note.week} - ${note.category}`,
    `Modifiée le ${formatNoteDate(note.updatedAt || note.createdAt)}`,
    "",
    note.content,
    ""
  ].join("\n"));

  const blob = new Blob([lines.join("\n---\n\n") || "Aucune note enregistrée."], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "carnet-notes-cap-patissier.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openPrintWindow(title, bodyHtml) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  const logoUrl = new URL("logo.png", window.location.href).href;
  printWindow.document.write(`
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          @page { margin: 18mm 16mm 20mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            color: #2d1d19;
            line-height: 1.55;
            margin: 0;
            padding: 28px 32px 72px;
          }
          .print-header {
            display: flex;
            align-items: center;
            gap: 14px;
            border-bottom: 2px solid #ffdac1;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .print-logo {
            width: 54px;
            height: 54px;
            object-fit: contain;
            border-radius: 10px;
          }
          .print-brand {
            font-weight: 800;
            font-size: 20px;
            margin: 0;
          }
          .print-subtitle {
            color: #6e5d59;
            font-size: 13px;
            margin: 2px 0 0;
          }
          .print-content h1 { font-size: 26px; margin: 0 0 6px; }
          .print-content h2 { font-size: 18px; margin-top: 24px; }
          .meta { color: #6e5d59; margin-bottom: 20px; font-weight: 700; }
          li { margin-bottom: 6px; }
          .print-footer {
            position: fixed;
            left: 32px;
            right: 32px;
            bottom: 20px;
            border-top: 1px solid #eaded8;
            padding-top: 8px;
            color: #6e5d59;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }
          @media print {
            body { padding: 0 0 28px; }
            .print-footer { left: 0; right: 0; bottom: 0; }
          }
        </style>
      </head>
      <body>
        <header class="print-header">
          <img class="print-logo" src="${logoUrl}" alt="CAP Pâtissier.AI">
          <div>
            <p class="print-brand">CAP Pâtissier.AI</p>
            <p class="print-subtitle">Support d'apprentissage CAP Pâtissier</p>
          </div>
        </header>
        <main class="print-content">${bodyHtml}</main>
        <footer class="print-footer">
          <span>CAP Pâtissier.AI</span>
          <span>© novaskilltech 2026</span>
        </footer>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 250);
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function printTechnicalSheet(title) {
  const fiche = fichesTechniques.find(item => item.titre === title);
  if (!fiche) return;
  trackRecentItem("fiche", title, "fiches");
  openPrintWindow(`Fiche technique - ${fiche.titre}`, `
    <h1>${escapeHtml(fiche.titre)}</h1>
    <div class="meta">${escapeHtml(fiche.categorie)} - ${escapeHtml(fiche.temps)}</div>
    <p>${escapeHtml(fiche.objectif)}</p>
    <h2>Matériel</h2>
    <ul>${fiche.materiel.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h2>Étapes clés</h2>
    <ol>${fiche.etapes.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    <h2>Points de contrôle</h2>
    <ul>${fiche.controles.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  `);
}

function printNote(note) {
  openPrintWindow(`Note - ${note.title}`, `
    <h1>${escapeHtml(note.title)}</h1>
    <div class="meta">Semaine ${note.week} - ${escapeHtml(note.category)}${note.sheetTitle ? ` - Fiche : ${escapeHtml(note.sheetTitle)}` : ""}</div>
    <p>${escapeHtml(note.content).replace(/\n/g, "<br>")}</p>
  `);
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

async function fetchProgrammeSessions() {
  try {
    const response = await fetch("/api/programme-sessions");
    if (!response.ok) throw new Error("Sessions endpoint unavailable");
    const data = await response.json();
    state.programme_sessions = data.sessions || {};
  } catch (error) {
    console.warn("Programme sessions unavailable, using fallback sessions.", error);
    state.programme_sessions = {};
  }
}

function getWeekByNumber(weekNum) {
  return getAllWeeks().find(week => week.num === weekNum) || { num: weekNum, titre: `Semaine ${weekNum}` };
}

function getAllWeeks() {
  if (!state.curriculum?.blocs) return [];
  return state.curriculum.blocs.flatMap(bloc => bloc.semaines || []);
}

function getWeekSessions(weekNum) {
  const sessions = state.programme_sessions[String(weekNum)] || state.programme_sessions[weekNum];
  if (Array.isArray(sessions) && sessions.length) return sessions;

  return [1, 2, 3, 4, 5].map(num => ({
    num,
    titre: `Séance ${num}`,
    label: `S${num}`
  }));
}

function getActiveSession() {
  const sessions = getWeekSessions(state.semaine_active || 1);
  return sessions.find(session => session.num === state.seance_active) || sessions[0] || { num: 1, titre: "Séance 1", label: "S1" };
}

function renderChatSessionPanel() {
  const panel = document.getElementById("chatSessionPanel");
  if (!panel) return;

  const week = getWeekByNumber(state.semaine_active || 1);
  const sessions = getWeekSessions(week.num);
  const activeSession = getActiveSession();

  panel.innerHTML = `
    <div class="session-context-card">
      <div class="session-context-title">
        <span>Position dans le programme</span>
        <strong>Semaine ${week.num} - S${activeSession.num} : ${escapeHtml(activeSession.titre)}</strong>
      </div>
      <div class="session-tabs" role="tablist" aria-label="Séances de la semaine ${week.num}">
        ${sessions.map(session => `
          <button class="session-tab-btn ${session.num === activeSession.num ? "active" : ""}" type="button" data-session-num="${session.num}" aria-label="Ouvrir la séance ${session.num}">
            <span>S${session.num}</span>
            <small>${escapeHtml(session.titre)}</small>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderWeekSessionPreview(weekNum) {
  return `
    <div class="week-sessions-preview">
      ${getWeekSessions(weekNum).map(session => `
        <div class="week-session-line"><strong>S${session.num}</strong> ${escapeHtml(session.titre)}</div>
      `).join("")}
    </div>
  `;
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

  renderTodayDashboard();
  renderRevisionPlanner();
  renderWeeklyChecklist();
  renderWeeklyQuiz();

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
          const isStarted = state.semaines_commencees.includes(semaine.num) && !isCompleted;
          const isLocked = semaine.num > 5 && !state.is_premium;
          return `
            <div class="week-item ${isStarted ? 'started' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}" data-week="${semaine.num}" style="${isLocked ? 'opacity: 0.7;' : ''}">
              <div class="week-badge">${isLocked ? '🔒 Premium' : (isCompleted ? '✅ Terminé' : (isStarted ? `En cours - Semaine ${semaine.num}` : `Semaine ${semaine.num}`))}</div>
              <h4>${semaine.titre}</h4>
              ${!isLocked ? renderWeekSessionPreview(semaine.num) : ""}
              ${isLocked ? `
                <p style="font-size:0.75rem; color:#ff6b67; margin-top:8px; font-weight:700;">Réservé aux membres premium</p>
              ` : `
                <div class="week-card-actions">
                  <button class="open-week-btn" type="button" data-week-open="${semaine.num}">Entrer</button>
                  <button class="toggle-complete-btn" type="button" data-week-toggle="${semaine.num}">
                    ${isCompleted ? "Marquer à faire" : "Marquer terminé"}
                  </button>
                </div>
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
        if (e.target.closest("[data-week-toggle]")) {
          e.stopPropagation();
          toggleWeekCompletion(num);
          return;
        }
        if (e.target.closest("[data-week-open]")) {
          e.stopPropagation();
          selectWeek(num);
          return;
        }
        selectWeek(num);
      });
    });

    container.appendChild(card);
  });

  renderChatSessionPanel();
  updateGlobalProgressPercent();
}

// Cocher/Décocher une semaine
function toggleWeekCompletion(num) {
  const index = state.progression.indexOf(num);
  if (index > -1) {
    state.progression.splice(index, 1);
  } else {
    markWeekStarted(num);
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
  state.seance_active = state.seances_actives_par_semaine[weekNum] || 1;
  markWeekStarted(weekNum);
  trackRecentItem("week", `Semaine ${weekNum}`, "chat", { week: weekNum, session: state.seance_active });
  saveStateToStorage();
  updateDashboardUI();
  switchTab("chat");

  openActiveSessionChat(false);
}

function selectSession(sessionNum) {
  state.seance_active = Math.min(Math.max(sessionNum, 1), 5);
  state.seances_actives_par_semaine[state.semaine_active] = state.seance_active;
  trackRecentItem("week", `Semaine ${state.semaine_active} - S${state.seance_active}`, "chat", {
    week: state.semaine_active,
    session: state.seance_active
  });
  saveStateToStorage();
  renderChatSessionPanel();
  openActiveSessionChat(true);
}

function openActiveSessionChat(showSwitchMessage) {
  const weekNum = state.semaine_active || 1;
  const activeSession = getActiveSession();
  renderChatSessionPanel();

  const chatMessages = document.getElementById("chatMessages");
  const savedHistory = loadChatHistory(weekNum, activeSession.num);
  
  if (savedHistory && savedHistory.length > 0) {
    // Restaurer l'historique existant
    state.historique_messages = savedHistory;
    chatMessages.innerHTML = "";
    
    // Ré-afficher tous les messages sauvegardés
    savedHistory.forEach(msg => {
      const role = msg.role === "model" ? "assistant" : "user";
      appendMessage(role, msg.text);
    });
    
    // Ajouter un message de reprise
    appendMessage("assistant", "On reprend **Semaine " + weekNum + " - S" + activeSession.num + " : " + activeSession.titre + "**. Pose-moi ta prochaine question quand tu es prêt.");
  } else {
    // Première visite de cette séance
    state.historique_messages = [];
    chatMessages.innerHTML = `
      <div class="message assistant">
        <div class="message-bubble">
          <p>Tu es en <strong>Semaine ${weekNum} - S${activeSession.num}</strong> : ${escapeHtml(activeSession.titre)}. On travaille cette séance pas à pas : objectif, notions clés, exercice pratique puis bilan.</p>
        </div>
      </div>
    `;
  }

  if (showSwitchMessage) {
    appendMessage("assistant", "Séance active : **Semaine " + weekNum + " - S" + activeSession.num + " : " + activeSession.titre + "**.");
  }
}

// Rendu du glossaire
function renderGlossaire(list) {
  const container = document.getElementById("glossaryGrid");
  container.innerHTML = "";
  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "glossary-card";
    const isFavorite = state.glossaire_favorites.includes(item.terme);
    card.innerHTML = `
      <button class="favorite-toggle ${isFavorite ? "active" : ""}" type="button" data-favorite-glossary="${item.terme}" aria-label="${isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}">
        ${isFavorite ? "★" : "☆"}
      </button>
      <h3>${item.terme}</h3>
      <p>${item.definition}</p>
    `;
    container.appendChild(card);
  });
}

function renderFichesTechniques(list) {
  const container = document.getElementById("technicalSheetsGrid");
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Aucune fiche trouvée</h3>
        <p>Essayez une autre recherche : pâte, crème, chocolat, examen, fonçage...</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(fiche => {
    const visual = getTechnicalSheetVisual(fiche);
    const isFavorite = state.fiches_favorites.includes(fiche.titre);
    const status = state.sheet_statuses[fiche.titre] || "À pratiquer";

    return `
    <article class="technical-sheet-card">
      <button class="favorite-toggle technical-sheet-favorite ${isFavorite ? "active" : ""}" type="button" data-favorite-sheet="${fiche.titre}" aria-label="${isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}">
        ${isFavorite ? "★" : "☆"}
      </button>
      <figure class="technical-sheet-visual ${visual.className}">
        ${renderTechnicalSheetSvg(fiche)}
        <figcaption>${visual.label}</figcaption>
      </figure>
      <div class="technical-sheet-header">
        <span class="technical-sheet-category">${fiche.categorie}</span>
        <span class="technical-sheet-time">${fiche.temps}</span>
      </div>
      <div class="sheet-status-row">
        ${["À pratiquer", "À revoir", "Maîtrisé"].map(option => `
          <button class="sheet-status ${status === option ? "active" : ""}" type="button" data-sheet-status="${fiche.titre}" data-status-value="${option}">
            ${option}
          </button>
        `).join("")}
      </div>
      <h3>${fiche.titre}</h3>
      <p>${fiche.objectif}</p>
      <div class="technical-sheet-block">
        <h4>Matériel</h4>
        <ul>
          ${fiche.materiel.map(item => `<li>${item}</li>`).join("")}
        </ul>
      </div>
      <div class="technical-sheet-block">
        <h4>Étapes clés</h4>
        <ol>
          ${fiche.etapes.map(etape => `<li>${etape}</li>`).join("")}
        </ol>
      </div>
      <div class="technical-sheet-block">
        <h4>Points de contrôle</h4>
        <ul>
          ${fiche.controles.map(controle => `<li>${controle}</li>`).join("")}
        </ul>
      </div>
      <button class="sheet-coach-btn" type="button" data-sheet-title="${fiche.titre}">
        Demander au coach
      </button>
      <div class="sheet-secondary-actions">
        <button type="button" data-sheet-open="${fiche.titre}">Consulter</button>
        <button type="button" data-sheet-note="${fiche.titre}">Ajouter une note</button>
        <button type="button" data-sheet-print="${fiche.titre}">Imprimer</button>
      </div>
    </article>
  `;
  }).join("");
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
        seance_active: state.seance_active,
        seance_active_detail: getActiveSession(),
        contexte_eleve: state.contexte_eleve,
        historique_messages: state.historique_messages.slice(-6)
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
    
    // Sauvegarder l'historique complet dans localStorage
    saveChatHistory(state.semaine_active, state.seance_active);
    


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

// Initialisation de la lecture audio au premier clic utilisateur (Autoplay bypass)
window.addEventListener("DOMContentLoaded", () => {
  const introAudio = document.getElementById("introAudio");
  const playPauseBtn = document.getElementById("audioPlayPauseBtn");
  const playIcon = playPauseBtn.querySelector(".play-icon");
  const pauseIcon = playPauseBtn.querySelector(".pause-icon");
  const audioStatus = document.querySelector(".audio-status");
  const audioWave = document.getElementById("audioWave");
  const playerWidget = document.getElementById("audioPlayerWidget");
  let hasPlayed = false;

  // Gestion des bulles de dialogue synchronisées avec l'audio
  const bubble = document.getElementById("chefSpeechBubble");
  const bubbleSpeaker = bubble.querySelector(".speech-speaker");
  const bubbleText = bubble.querySelector(".speech-text");

  const dialogues = [
    { start: 0, end: 5.5, speaker: "Julie 👩‍🍳", text: "Saviez-vous que 60% des candidats libres au CAP abandonnent avant l'examen ?" },
    { start: 5.5, end: 10.0, speaker: "Thomas (Apprenti) 👨‍🍳", text: "Attends... 60 % ? C'est énorme ! Pourquoi tant de découragement ?" },
    { start: 10.0, end: 15.5, speaker: "Julie 👩‍🍳", text: "Principalement à cause du manque de structure et de l'isolement dans leur cuisine." },
    { start: 15.5, end: 25.5, speaker: "Thomas (Apprenti) 👨‍🍳", text: "Mais CAP Pâtissier.AI change la donne avec une méthode structurée pas à pas !" },
    { start: 25.5, end: 32.5, speaker: "Julie 👩‍🍳", text: "5 semaines gratuites pour s'organiser, apprendre les bases et les techniques pro." },
    { start: 32.5, end: 45.0, speaker: "Thomas (Apprenti) 👨‍🍳", text: "Puis le reste du programme de 52 semaines pour réviser et simuler l'examen blanc !" }
  ];

  introAudio.addEventListener("timeupdate", () => {
    if (!isLandingAudioEnabled()) {
      disableLandingAudio();
      return;
    }

    const currentTime = introAudio.currentTime;
    let currentDialogue = dialogues.find(d => currentTime >= d.start && currentTime < d.end);

    if (currentDialogue) {
      bubble.style.opacity = "1";
      bubble.style.transform = "translateY(0) scale(1)";
      bubbleSpeaker.innerText = currentDialogue.speaker;
      bubbleText.innerText = currentDialogue.text;

      if (currentDialogue.speaker.includes("Thomas")) {
        bubble.classList.add("thomas-talking");
        bubble.classList.remove("julie-talking");
      } else {
        bubble.classList.add("julie-talking");
        bubble.classList.remove("thomas-talking");
      }
    } else {
      bubble.style.opacity = "0";
      bubble.style.transform = "translateY(10px) scale(0.95)";
    }
  });

  introAudio.addEventListener("ended", () => {
    bubble.style.opacity = "0";
    pauseAudio();
  });

  function playAudio() {
    if (!isLandingAudioEnabled()) {
      disableLandingAudio();
      return;
    }

    introAudio.play().then(() => {
      hasPlayed = true;
      playIcon.style.display = "none";
      pauseIcon.style.display = "inline";
      audioStatus.innerText = "Lecture en cours";
      audioWave.classList.add("playing");
      playerWidget.classList.add("active");
    }).catch(err => {
      console.log("Autoplay bloqué ou échoué:", err);
    });
  }

  function pauseAudio() {
    introAudio.pause();
    playIcon.style.display = "inline";
    pauseIcon.style.display = "none";
    audioStatus.innerText = "En pause";
    audioWave.classList.remove("playing");
  }

  // Écouter le clic sur le bouton lui-même
  playPauseBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Éviter de déclencher le listener global
    if (!isLandingAudioEnabled()) return;

    if (introAudio.paused) {
      playAudio();
    } else {
      pauseAudio();
    }
  });

  // Déclencher au premier clic n'importe où sur le document pour simuler l'autoplay
  document.addEventListener("click", () => {
    if (!hasPlayed && isLandingAudioEnabled()) {
      playAudio();
    }
  }, { once: true });
});

