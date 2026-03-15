// Fonction pour formater la date
function formaterDate(dateString) {
    if (!dateString) return "";
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    const date = new Date(dateString);
    let formated = date.toLocaleDateString('fr-FR', options);
    let parts = formated.split(' ');
    if (parts.length === 3) {
        return `${parts[0]} <span>―</span> ${parts[1]} ${parts[2]}`;
    }
    return formated;
}

// Fonction pour déterminer la couleur de la pastille
function getClassePastille(categorie) {
    if (!categorie) return 'pastille article';
    if (categorie.toLowerCase() === 'podcast') return 'pastille podcast';
    if (categorie.toLowerCase() === 'interview') return 'pastille interview';
    return 'pastille article';
}

// Récupération des données depuis la racine
fetch('page/donnees.json')
    .then(response => response.json())
    .then(articles => {
        const conteneur = document.getElementById('grille-aleatoire');
        conteneur.innerHTML = ''; // On vide le message de chargement

        // 1. On mélange le tableau d'articles au hasard (Shuffle)
        const articlesMelanges = articles.sort(() => 0.5 - Math.random());

        // 2. On garde uniquement les 3 premiers articles pour la grille d'accueil
        const articlesAffiches = articlesMelanges.slice(0, 3);

        articlesAffiches.forEach(article => {
            // Ajustement des liens car on est à la racine (index.html) et pas dans le dossier "page"
            const urlDestination = article.lien ? article.lien : `page/article.html?id=${article.id}`;
            const target = article.lien ? `target="_blank"` : ``;

            // Ajustement de l'image de secours si Margault n'a pas mis de photo
            let imageSrc = article.image;
            if (imageSrc.startsWith("../")) {
                imageSrc = imageSrc.substring(3); // Transforme "../img/..." en "img/..."
            }

            const carteHTML = `
                <a href="${urlDestination}" class="link-act event podcast-card" ${target}>
                    <div class="cover">
                        <picture>
                            <img src="${imageSrc}" alt="${article.titre}">
                        </picture>
                        <div class="lespastilles">
                            <div class="${getClassePastille(article.categorie)}">${article.categorie}</div>
                        </div>
                    </div>
                    <div class="flex-info">
                        <h2 class="date-event">${formaterDate(article.date)}</h2>
                    </div>
                    <h3 class="name-event">${article.titre}</h3>
                </a>
            `;
            conteneur.innerHTML += carteHTML;
        });
    })
    .catch(error => {
        console.error("Erreur lors du chargement des articles de l'accueil:", error);
        document.getElementById('grille-aleatoire').innerHTML = "<p>Impossible de charger les articles récents.</p>";
    });

// 3. Injecter des images aléatoires du dossier img/ dans les titres en fond (marquee)
document.addEventListener("DOMContentLoaded", () => {
    const dynBgImages = document.querySelectorAll('.dyn-bg-img');
    if (dynBgImages.length > 0) {
        // Liste d'images dynamiques et variées disponibles dans le dossier img/
        const imagesDisponibles = [
            "Amants du midi.jpg",
            "Bom_festival.jpg",
            "Eric_et_Jean_SEb.jpg",
            "HMAP.jpg",
            "Lehosp1.jpg",
            "Lost_in_hope.jpg",
            "Loucas.jpg",
            "Parasyth.jpg",
            "Soupair image.jpg",
            "Syka_et_le_Jy.jpg",
            "Tinaturner.jpg",
            "Tous en scène.jpg",
            "Trafalgar.jpg",
            "Two Magnets.jpg",
            "Wilko _ Ndy.jpg",
            "Yelisa.jpg",
            "charlyetmargault.jpg",
            "curtism.jpg",
            "lehos_2.jpg",
            "les_garcons_trottoirs.jpg",
            "michel.jpg",
            "nebbiu.jpeg",
            "photo RFTP.jpg",
            "photo ecovirage.jpg",
            "scarabé_.jpg"
        ];
        
        // On mélange la liste pour garantir l'aléatoire à chaque rechargement
        const imagesMelangees = imagesDisponibles.sort(() => 0.5 - Math.random());
        
        dynBgImages.forEach((imgElement, index) => {
            // On applique une image aléatoire à chaque balise de fond
            imgElement.src = "img/" + imagesMelangees[index % imagesMelangees.length];
        });
    }
});