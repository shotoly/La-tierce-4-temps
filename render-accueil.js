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