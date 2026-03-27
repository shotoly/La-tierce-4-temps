const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { marked } = require('marked');
const fs = require('fs');
const https = require('https');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });
const databaseId = process.env.NOTION_DATABASE_ID;

// --- NOUVEAU : On apprend à l'outil à lire les colonnes Notion ---
n2m.setCustomTransformer('column_list', async (block) => {
    const { results } = await notion.blocks.children.list({ block_id: block.id });
    const mdblocks = await n2m.blocksToMarkdown(results);
    const mdString = n2m.toMarkdownString(mdblocks);
    // Les sauts de ligne (\n\n) sont obligatoires pour que le texte dedans soit bien mis en forme (gras, titres...)
    return `\n<div class="notion-row">\n\n${mdString.parent || mdString || ""}\n\n</div>\n`;
});

n2m.setCustomTransformer('column', async (block) => {
    const { results } = await notion.blocks.children.list({ block_id: block.id });
    const mdblocks = await n2m.blocksToMarkdown(results);
    const mdString = n2m.toMarkdownString(mdblocks);
    return `\n<div class="notion-col">\n\n${mdString.parent || mdString || ""}\n\n</div>\n`;
});
const parseYouTubeUrl = (url) => {
    let videoId = '';
    let isShort = false;
    if (url.includes('youtube.com/watch')) {
        try { videoId = new URL(url).searchParams.get('v'); } catch (e) { }
    } else if (url.includes('youtu.be/')) {
        try { videoId = new URL(url).pathname.substring(1); } catch (e) { }
    } else if (url.includes('youtube.com/shorts/')) {
        try {
            videoId = new URL(url).pathname.split('/shorts/')[1].split('?')[0];
            isShort = true;
        } catch (e) { }
    }
    return { videoId, isShort };
};

const renderYouTubeEmbed = (videoId, isShort) => {
    if (isShort) {
        return `\n<div style="max-width: 350px; margin: 40px auto;"><div class="notion-short-wrapper" style="position: relative; width: 100%; padding-bottom: 177.77%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://www.youtube.com/embed/${videoId}?loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>\n`;
    } else {
        return `\n<div class="notion-video-wrapper"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n`;
    }
};

n2m.setCustomTransformer('video', async (block) => {
    const video = block.video;
    if (!video) return '';
    let url = '';
    if (video.type === 'external') {
        url = video.external.url;
    } else if (video.type === 'file') {
        url = video.file.url;
    }

    if (!url) return '';

    // Transformation d'URL pour YouTube
    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const { videoId, isShort } = parseYouTubeUrl(url);
        if (videoId) return renderYouTubeEmbed(videoId, isShort);
    } else if (url.includes('vimeo.com/')) {
        try {
            const urlObj = new URL(url);
            const videoId = urlObj.pathname.substring(1);
            if (videoId) {
                return `\n<div class="notion-video-wrapper"><iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
            }
        } catch (e) { }
    }

    // Vidéo hébergée en direct
    return `\n<div class="notion-video-wrapper"><video controls src="${url}"></video></div>\n`;
});

// Ajouter aussi le transformer pour les embeds (quand l'URL est collée comme Intégration / Embed)
n2m.setCustomTransformer('embed', async (block) => {
    const embed = block.embed;
    if (!embed || !embed.url) return '';
    const url = embed.url;

    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const { videoId, isShort } = parseYouTubeUrl(url);
        if (videoId) return renderYouTubeEmbed(videoId, isShort);
    }

    // Si on ne sait pas quoi en faire, on affiche au moins le lien
    return `\n<a href="${url}" target="_blank" class="link-act" style="color: var(--provence-violet);">${url}</a>\n`;
});
// -----------------------------------------------------------------

// --- Fonction pour télécharger et sauvegarder une image localement ---
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        // Create directory if it doesn't exist just in case
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const file = fs.createWriteStream(filepath);
        https.get(url, response => {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
            } else {
                reject(new Error(`Failed to download image: ${response.statusCode}`));
            }
        }).on('error', err => {
            fs.unlink(filepath, () => reject(err));
        });
    });
}

async function fetchNotionData() {
    try {
        console.log("Connexion à Notion en cours...");
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: 'Date', direction: 'descending' }],
        });

        const articles = await Promise.all(response.results.map(async page => {
            const id = page.id;

            const titre = page.properties["Nom"]?.title?.[0]?.plain_text || "Sans titre";
            const date = page.properties["Date"]?.date?.start || "";

            const propCat = page.properties["Catégorie"] || page.properties["Categorie"];
            let categorie = "Article";
            if (propCat?.select) categorie = propCat.select.name;
            else if (propCat?.multi_select?.[0]) categorie = propCat.multi_select[0].name;

            const lien = page.properties["Lien"]?.url || "";

            let image = "../img/logo.svg";
            if (page.properties["Image"]?.files?.length > 0) {
                const imgFichier = page.properties["Image"].files[0];
                const originalUrl = imgFichier.type === 'file' ? imgFichier.file.url : imgFichier.external.url;

                // Téléchargement physique de l'image
                try {
                    const ext = originalUrl.split('?')[0].split('.').pop() || 'jpg';
                    // We save it to 'img/notion_[id].ext' to be available for the root index and 'page/' routes
                    const localFilename = `notion_${id}.${ext}`;
                    const localFilepath = path.join(__dirname, 'img', localFilename);

                    console.log(`Téléchargement de l'image pour ${titre}...`);
                    await downloadImage(originalUrl, localFilepath);

                    // On donne le lien relatif pour que le site la trouve
                    image = `../img/${localFilename}`;
                } catch (imgError) {
                    console.error(`Erreur de téléchargement pour l'image de ${titre}:`, imgError.message);
                    image = originalUrl; // Fallback to original URL if download fails
                }
            }

            // --- NOUVEAU : Récupération de l'Image Vinyl Personnalisée ---
            let imageVinyl = null;
            if (page.properties["Image Vinyl"]?.files?.length > 0) {
                const vinylFichier = page.properties["Image Vinyl"].files[0];
                const originalVinylUrl = vinylFichier.type === 'file' ? vinylFichier.file.url : vinylFichier.external.url;

                try {
                    const ext = originalVinylUrl.split('?')[0].split('.').pop() || 'png';
                    const localFilename = `vinyl_${id}.${ext}`;
                    const localFilepath = path.join(__dirname, 'img', localFilename);

                    console.log(`Téléchargement de l'image vinyl pour ${titre}...`);
                    await downloadImage(originalVinylUrl, localFilepath);

                    // Lien relatif pour le site
                    imageVinyl = `../img/${localFilename}`;
                } catch (vinylError) {
                    console.error(`Erreur de téléchargement pour l'image vinyl de ${titre}:`, vinylError.message);
                    imageVinyl = originalVinylUrl;
                }
            }

            // Récupération du fichier Audio (Ignoré pour le téléchargement local car hébergé sur YouTube)
            let audioUrl = "";
            if (page.properties["Audio"]?.files?.length > 0) {
                const audioFichier = page.properties["Audio"].files[0];
                audioUrl = audioFichier.type === 'file' ? audioFichier.file.url : audioFichier.external.url;
            }

            // --- LA MAGIE OPÈRE ICI ---
            const mdblocks = await n2m.pageToMarkdown(page.id);
            const mdStringObj = n2m.toMarkdownString(mdblocks);

            let texteMarkdown = "";
            if (typeof mdStringObj === 'string') {
                texteMarkdown = mdStringObj;
            } else if (mdStringObj && mdStringObj.parent) {
                texteMarkdown = mdStringObj.parent;
            }

            let contenuHtml = marked.parse(texteMarkdown);

            // --- NOUVEAU : Aspirateur d'images internes Notion ---
            // Recherche de toutes les images dans le contenu HTML généré
            const imgRegex = /<img[^>]+src="([^">]+)"/gi;
            const matches = [...contenuHtml.matchAll(imgRegex)];
            let imgIndex = 0;

            for (const match of matches) {
                const originalImgUrl = match[1];

                // Si l'URL de l'image pointe vers un serveur externe (Notion AWS s3, etc.)
                if (originalImgUrl.startsWith('http')) {
                    imgIndex++;
                    try {
                        const urlObj = new URL(originalImgUrl);
                        let ext = urlObj.pathname.split('.').pop();
                        // Nettoyage de l'extension pour s'assurer qu'elle est valide
                        if (!ext || ext.length > 4 || !ext.match(/^[a-zA-Z0-9]+$/)) {
                            ext = 'jpg';
                        }

                        // ID unique de l'image basé sur l'ID de l'article et l'index
                        const filename = `interne_${id}_${imgIndex}.${ext}`;
                        const filepath = path.join(__dirname, 'img', filename);

                        console.log(`Téléchargement de l'image interne ${imgIndex} pour l'article ${titre}...`);
                        await downloadImage(originalImgUrl, filepath);

                        // Remplacement de l'URL AWS temporaire par le chemin local relatif
                        const localUrl = `../img/${filename}`;
                        contenuHtml = contenuHtml.split(originalImgUrl).join(localUrl);
                    } catch (err) {
                        console.error(`Erreur lors du téléchargement de l'image interne ${imgIndex} pour ${titre}:`, err.message);
                    }
                }
            }

            // --- REMPLACEMENT DES NOMS DE RÉSEAUX PAR DES LOGOS ---
            const iconMappings = {
                'instagram': '<i class="fa-brands fa-instagram" style="color: #E1306C; font-size: 1.5em; vertical-align: middle;"></i>',
                'youtube': '<i class="fa-brands fa-youtube" style="color: #FF0000; font-size: 1.5em; vertical-align: middle;"></i>',
                'facebook': '<i class="fa-brands fa-facebook" style="color: #1877F2; font-size: 1.5em; vertical-align: middle;"></i>',
                'tiktok': '<i class="fa-brands fa-tiktok" style="font-size: 1.5em; vertical-align: middle;"></i>',
                'spotify': '<i class="fa-brands fa-spotify" style="color: #1DB954; font-size: 1.5em; vertical-align: middle;"></i>',
                'linktr\\.ee|link[-\\s]*tree': '<i class="fa-brands fa-linktree" style="color: #43E660; font-size: 1.25em; vertical-align: text-bottom; margin-right: 5px;"></i>',
                'deezer': '<i class="fa-brands fa-deezer" style="font-size: 1.5em; vertical-align: middle;"></i>',
                'apple[-\\s]*podcast': '<i class="fa-solid fa-podcast" style="color: #872EC4; font-size: 1.5em; vertical-align: middle;"></i>',
                'soundcloud': '<i class="fa-brands fa-soundcloud" style="color: #FF5500; font-size: 1.5em; vertical-align: middle;"></i>'
            };

            for (const [networkPattern, iconHtml] of Object.entries(iconMappings)) {
                // On cherche "NomRéseau: <a href="URL">...</a>" incluant potentiellement des balises (strong, em, etc.) 
                // et on extrait l'URL pour la placer uniquement dans l'icône cliquable.
                const regex = new RegExp(`(?:<[^>]+>)*\\b(${networkPattern})\\b(?:<\\/[^>]+>)*\\s*:\\s*(?:<[^>]+>)*<a\\s+href="([^"]+)"[^>]*>.*?<\\/a>`, 'gi');

                contenuHtml = contenuHtml.replace(regex, (match, p1, href) => {
                    return `<!--SOCIAL_LINK_START--><a href="${href}" target="_blank" class="social-icon-link" style="display:flex; align-items:center; justify-content:center; width: 44px; height: 44px; background: rgba(255, 255, 255, 0.1); border-radius: 50%; text-decoration:none; transition: all 0.2s ease; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);">${iconHtml}</a><!--SOCIAL_LINK_END-->`;
                });
            }

            // Regrouper tous les liens sociaux consécutifs (séparés ou non par des <p>, <br>, <li>, etc.) 
            // dans un seul conteneur flex horizontal.
            const cleanRe = /((?:<\/?(?:p|ul|li|br|strong|em)[^>]*>|\s*)*<!--SOCIAL_LINK_START-->(?:.*?)<!--SOCIAL_LINK_END-->(?:<\/?(?:p|ul|li|br|strong|em)[^>]*>|\s*)*)+/gi;

            contenuHtml = contenuHtml.replace(cleanRe, (match) => {
                const links = [];
                const linkRe = /<!--SOCIAL_LINK_START-->(.*?)<!--SOCIAL_LINK_END-->/g;
                let linkMatch;
                while ((linkMatch = linkRe.exec(match)) !== null) {
                    links.push(linkMatch[1]);
                }
                if (links.length > 0) {
                    return `\n<div class="social-links-container" style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap; margin: 20px 0;">\n` + links.join('\n') + `\n</div>\n`;
                }
                return match;
            });

            // --- NOUVEAU : Récupérer la case à cocher "Accueil" ---
            const estAfficheAccueil = page.properties["Accueil"]?.checkbox || false;

            return {
                id,
                titre,
                date,
                categorie,
                lien,
                image,
                imageVinyl, // Nouvelle propriété pour l'album art !
                audio: audioUrl,
                contenu: contenuHtml,
                accueil: estAfficheAccueil
            };
        }));

        const articlesPropres = articles.filter(article => article.titre !== "Sans titre");

        fs.writeFileSync(path.join(__dirname, 'page', 'donnees.json'), JSON.stringify(articlesPropres, null, 2));
        console.log("Fichier donnees.json généré avec le CONTENU des articles et les images locales !");

    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        process.exit(1);
    }
}

fetchNotionData();
