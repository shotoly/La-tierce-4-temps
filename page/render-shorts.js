document.addEventListener('DOMContentLoaded', () => {
    fetch('donnees.json')
        .then(response => response.json())
        .then(articles => {
            const conteneur = document.getElementById('grille-shorts');
            conteneur.innerHTML = ''; // Vider le texte de chargement

            // Filtrer tous les éléments ayant la catégorie "Short" ou assimilé
            const shorts = articles.filter(article => 
                article.categorie && article.categorie.toLowerCase().includes('short')
            );

            if (shorts.length === 0) {
                conteneur.innerHTML = "<p style='text-align: center; width: 100%;'>Aucun Short disponible pour le moment.</p>";
                return;
            }

            // Générer le HTML pour chaque short
            shorts.forEach(short => {
                let videoId = "";
                const url = short.lien || short.audio || "";
                
                // Extraction de l'ID YouTube
                if (url.includes("/shorts/")) {
                    videoId = url.split("/shorts/")[1].split("?")[0];
                } else if (url.includes("youtu.be/")) {
                    videoId = url.split("youtu.be/")[1].split("?")[0];
                } else if (url.includes("watch?v=")) {
                    try {
                        videoId = new URL(url).searchParams.get("v");
                    } catch (e) {}
                }

                if (!videoId) return; // Ignorer si pas d'ID valide

                const iframeHtml = `
                    <div class="short-card">
                        <div class="short-wrapper">
                            <iframe 
                                src="https://www.youtube.com/embed/${videoId}?autoplay=0&loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" 
                                title="${short.titre}" 
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                allowfullscreen>
                            </iframe>
                        </div>
                        <h3 class="name-event" style="font-size: 1.2rem; margin-top: 15px; text-align: center;">${short.titre}</h3>
                    </div>
                `;
                conteneur.innerHTML += iframeHtml;
            });
            
            // Re-update Locomotive Scroll after images/iframes load
            setTimeout(() => {
                if (window.locoScroll) {
                    window.locoScroll.update();
                }
            }, 1000);
        })
        .catch(error => {
            console.error("Erreur lors du chargement des shorts:", error);
            document.getElementById('grille-shorts').innerHTML = "<p>Erreur lors du chargement des données.</p>";
        });
});
