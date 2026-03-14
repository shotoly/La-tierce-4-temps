// Fonction pour formater la date (ex: 2026-03-05 -> 05 mars 2026)
function formaterDate(dateString) {
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    const date = new Date(dateString);
    let formated = date.toLocaleDateString('fr-FR', options);
    // Sépare le jour du reste pour faire le style avec le tiret
    let parts = formated.split(' ');
    if (parts.length === 3) {
        return `${parts[0]} <span>―</span> ${parts[1]} ${parts[2]}`;
    }
    return formated;
}

// Fonction pour déterminer la couleur de la pastille
function getClassePastille(categorie) {
    if (categorie.toLowerCase() === 'podcast') return 'pastille podcast';
    if (categorie.toLowerCase() === 'interview') return 'pastille interview';
    return 'pastille article'; // Par défaut
}

// Récupération des données et affichage
fetch('donnees.json')
    .then(response => response.json())
    .then(articles => {
        const conteneur = document.getElementById('grille-podcasts');
        conteneur.innerHTML = ''; // On vide le "Chargement..."

        articles.forEach(article => {
            const carteHTML = `
                <a href="${article.lien}" class="link-act event podcast-card" target="_blank">
                    <div class="cover">
                        <picture>
                            <img src="${article.image}" alt="${article.titre}">
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
        console.error("Erreur lors du chargement des articles:", error);
        document.getElementById('grille-podcasts').innerHTML = "<p>Impossible de charger les articles pour le moment.</p>";
    });