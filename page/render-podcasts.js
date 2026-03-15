let allArticles = [];

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

function renderGrid(articlesToDisplay) {
    const conteneur = document.getElementById('grille-podcasts');
    conteneur.innerHTML = '';
    
    if (articlesToDisplay.length === 0) {
        conteneur.innerHTML = '<p style="text-align: center; width: 100%; color: var(--couleur-texte-secondaire);">Aucun résultat trouvé.</p>';
        return;
    }

    articlesToDisplay.forEach(article => {
        const urlDestination = article.lien ? article.lien : `article.html?id=${article.id}`;
        const target = article.lien ? `target="_blank"` : ``;

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

    // Optionnel: dire à locomotive scroll qu'on a mis à jour la taille du conteneur
    if (window.locoScroll && typeof window.locoScroll.update === "function") {
        setTimeout(() => window.locoScroll.update(), 500);
    }
}

function initFilters() {
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('filter-category');
    const sortSelect = document.getElementById('sort-date');

    // Extraire les catégories uniques pour remplir le menu déroulant
    const categories = [...new Set(allArticles.map(a => a.categorie).filter(Boolean))];
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });

    function applyFilters() {
        const searchText = searchInput.value.toLowerCase();
        const category = categorySelect.value;
        const sortOrder = sortSelect.value;

        // Filtrage
        let filtered = allArticles.filter(article => {
            const matchSearch = article.titre.toLowerCase().includes(searchText) || (article.categorie && article.categorie.toLowerCase().includes(searchText));
            const matchCategory = category === 'all' || article.categorie === category;
            return matchSearch && matchCategory;
        });

        // Tri
        filtered.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        renderGrid(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    categorySelect.addEventListener('change', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
}

// Récupération des données et affichage
fetch('donnees.json')
    .then(response => response.json())
    .then(articles => {
        allArticles = articles;
        initFilters();
        renderGrid(allArticles);
    })
    .catch(error => {
        console.error("Erreur lors du chargement des articles:", error);
        document.getElementById('grille-podcasts').innerHTML = "<p>Impossible de charger les articles pour le moment.</p>";
    });
