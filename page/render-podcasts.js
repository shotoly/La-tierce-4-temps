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

// Récupération des données et affichage
fetch('donnees.json')
    .then(response => response.json())
    .then(articles => {
        const conteneur = document.getElementById('grille-podcasts');
        conteneur.innerHTML = ''; // On vide le message de chargement

        articles.forEach(article => {
            // Logique du lien (si Notion contient un lien, on l'utilise, sinon on ouvre la page article)
            const urlDestination = article.lien ? article.lien : `article.html?id=${article.id}`;
            const target = article.lien ? `target="_blank"` : ``;

            // Construction de la carte (Attention aux espaces autour des balises !)
            const carteHTML = `
                <a href="${urlDestination}" class="link-act event podcast-card" ${target}>
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
