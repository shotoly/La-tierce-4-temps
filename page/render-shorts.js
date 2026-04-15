document.addEventListener('DOMContentLoaded', () => {
    fetch('donnees.json')
        .then(response => response.json())
        .then(articles => {
            const conteneur = document.getElementById('grille-shorts');
            conteneur.innerHTML = ''; // Vider le texte de chargement

            // Filtrer tous les éléments ayant la catégorie "Short" ou assimilé
            const shorts = articles.filter(article => 
                article.categorie?.toLowerCase().includes('short')
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
                    } catch { /* ignore */ }
                }

                if (!videoId) return; // Ignorer si pas d'ID valide

                let imageUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
                if (short.image && !short.image.includes('default-thumbnail')) {
                    imageUrl = short.image.startsWith('img/') ? '../' + short.image : short.image;
                }

                const iframeHtml = `
                    <div class="short-card">
                        <div class="short-wrapper" style="cursor: pointer; position: relative;" onclick="playShort('${videoId}', this)">
                            <img src="${imageUrl}" alt="${short.titre}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;" onerror="this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.6); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; transition: background 0.3s;" onmouseover="this.style.background='var(--provence-violet)'" onmouseout="this.style.background='rgba(0,0,0,0.6)'">
                                <i class="fa-solid fa-play" style="color: white; font-size: 24px; margin-left: 5px;"></i>
                            </div>
                        </div>
                        <h3 class="name-event" style="font-size: 1.2rem; margin-top: 15px; text-align: center;">${short.titre}</h3>
                    </div>
                `;
                conteneur.innerHTML += iframeHtml;
            });
            
            // Re-update Locomotive Scroll after images/iframes load
            setTimeout(() => {
                if (globalThis.locoScroll) {
                    globalThis.locoScroll.update();
                    globalThis.dispatchEvent(new Event('resize'));
                }
            }, 1000);
        })
        .catch(error => {
            console.error("Erreur lors du chargement des shorts:", error);
            document.getElementById('grille-shorts').innerHTML = "<p>Erreur lors du chargement des données.</p>";
        });
});

globalThis.playShort = function(videoId, wrapper) {
    wrapper.innerHTML = `
        <iframe 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" 
            title="Video" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen
            style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;">
        </iframe>
    `;
    wrapper.style.cursor = 'default';
    wrapper.onclick = null;
};
