document.addEventListener('DOMContentLoaded', () => {
    fetch('page/donnees.json')
        .then(response => response.json())
        .then(articles => {
            const conteneur = document.getElementById('grille-shorts-accueil');
            if(!conteneur) return;
            
            conteneur.innerHTML = ''; // Vider le texte de chargement

            // Filtrer tous les éléments ayant la catégorie "Short"
            const shorts = articles.filter(article => 
                article.categorie && article.categorie.toLowerCase().includes('short')
            );

            if (shorts.length === 0) {
                conteneur.innerHTML = "<p style='text-align: center; width: 100%;'>Aucun Short disponible dans Notion pour le moment.<br><br><i>Astuce : Ajoutez une page dans Notion avec Catégorie = 'Short' et un lien YouTube dans la colonne 'Lien'.</i></p>";
                return;
            }

            // Mélanger aléatoirement et prendre les 5 premiers
            const randomShorts = shorts.sort(() => 0.5 - Math.random()).slice(0, 5);

            // Générer le HTML
            randomShorts.forEach(short => {
                let videoId = "";
                const url = short.lien || "";
                
                if (url.includes("/shorts/")) {
                    videoId = url.split("/shorts/")[1].split("?")[0];
                } else if (url.includes("youtu.be/")) {
                    videoId = url.split("youtu.be/")[1].split("?")[0];
                } else if (url.includes("watch?v=")) {
                    try {
                        videoId = new URL(url).searchParams.get("v");
                    } catch (e) {}
                }

                if (!videoId) return; 

                const iframeHtml = `
                    <div class="short-card" style="flex: 0 0 auto; width: 250px; scroll-snap-align: start;">
                        <div class="short-wrapper" style="position: relative; width: 100%; padding-bottom: 177.77%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
                            <iframe 
                                style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;"
                                src="https://www.youtube.com/embed/${videoId}?autoplay=0&loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" 
                                title="${short.titre}" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                allowfullscreen>
                            </iframe>
                        </div>
                        <h3 class="name-event" style="font-size: 1.1rem; margin-top: 15px; text-align: center; white-space: normal;">${short.titre}</h3>
                    </div>
                `;
                conteneur.innerHTML += iframeHtml;
            });
            
            // Re-update Locomotive Scroll after changes
            setTimeout(() => {
                if (window.locoScroll) {
                    window.locoScroll.update();
                }
            }, 1000);
        })
        .catch(error => {
            console.error("Erreur lors du chargement des shorts pour l'accueil:", error);
            const conteneur = document.getElementById('grille-shorts-accueil');
            if(conteneur) {
                conteneur.innerHTML = "<p>Erreur lors du chargement des données. Assurez-vous d'avoir exécuté la génération Notion.</p>";
            }
        });
});
