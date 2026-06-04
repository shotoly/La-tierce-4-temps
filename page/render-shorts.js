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
                let videoType = "youtube";
                const url = short.lien || short.audio || "";

                // Extraction de l'ID YouTube ou Vimeo
                if (url.includes("/shorts/")) {
                    videoId = url.split("/shorts/")[1].split("?")[0];
                } else if (url.includes("youtu.be/")) {
                    videoId = url.split("youtu.be/")[1].split("?")[0];
                } else if (url.includes("watch?v=")) {
                    try {
                        videoId = new URL(url).searchParams.get("v");
                    } catch { /* ignore */ }
                } else if (url.includes("vimeo.com/")) {
                    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
                    if (match) {
                        videoId = match[1];
                        videoType = 'vimeo';
                    }
                } else if (url.includes("drive.google.com/file/d/")) {
                    const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (match) {
                        videoId = match[1];
                        videoType = 'drive';
                    }
                }

                if (!videoId) return; // Ignorer si pas d'ID valide

                let imageUrl = (videoType === 'vimeo' || videoType === 'drive') ? "" : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
                if (short.image && !short.image.includes('default-thumbnail')) {
                    imageUrl = short.image.startsWith('img/') ? '../' + short.image : short.image;
                }

                const iframeHtml = `
                    <div class="short-card">
                        <div class="short-wrapper" style="cursor: pointer; position: relative;" onclick="playShort('${videoId}', this, '${videoType}')">
                            <img src="${imageUrl}" alt="${short.titre}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;" onerror="if('${videoType}' === 'youtube') this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'">
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

globalThis.playShort = function(videoId, wrapper, videoType = 'youtube') {
    let iframeHtml = '';
    
    if (videoType === 'vimeo') {
        iframeHtml = `
            <iframe 
                src="https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&autopause=0" 
                title="Video" 
                width="100%" height="100%" frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                allowfullscreen
                style="position: absolute; top:0; left:0; border:none; width:100%; height:100%;">
            </iframe>`;
    } else if (videoType === 'drive') {
        // Un dézoom modéré pour garder l'UI cliquable sur mobile tout en évitant la barre noire
        iframeHtml = `
            <iframe 
                src="https://drive.google.com/file/d/${videoId}/preview?autoplay=1" 
                width="100%" height="100%" frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                allowfullscreen
                style="position: absolute; top:0; left:0; border:none; width:200%; height:200%; transform: scale(0.5); transform-origin: top left;">
            </iframe>`;
    } else if (videoType === 'native') {
        iframeHtml = `
            <video 
                src="${videoId}" 
                autoplay 
                playsinline
                style="position: absolute; top:0; left:0; width:100%; height:100%; border:none; object-fit: contain; background: #000;">
            </video>`;
    } else {
        iframeHtml = `
            <iframe 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" 
                title="Video" 
                width="100%" height="100%" frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" 
                allowfullscreen
                style="position: absolute; top:0; left:0; border:none; width:100%; height:100%;">
            </iframe>`;
    }

    wrapper.innerHTML = iframeHtml;
    wrapper.style.cursor = 'default';
    wrapper.onclick = null;
};
