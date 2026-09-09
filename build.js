const { Client, LogLevel } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { marked } = require('marked');
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');
const path = require('node:path');

// --- DÉBUT : Intercepteurs globaux pour logger TOUTES les requêtes API ---
const patchRequest = (moduleObj, moduleName) => {
    const originalRequest = moduleObj.request;
    moduleObj.request = function(...args) {
        const req = originalRequest.apply(this, args);
        let url = 'unknown';
        if (typeof args[0] === 'string') url = args[0];
        else if (args[0] && args[0].href) url = args[0].href;
        else if (args[0] && args[0].hostname) url = `${args[0].protocol || moduleName + ':'}//${args[0].hostname}${args[0].path || ''}`;
        
        // On ignore les logs de téléchargement d'images internes pour éviter le spam, sauf s'ils plantent
        const isImg = url.includes('.jpg') || url.includes('.png');
        if (!isImg) console.log(`\x1b[90m[${moduleName.toUpperCase()} REQ] --> ${url}\x1b[0m`);
        
        req.on('response', (res) => {
            if (!isImg || res.statusCode >= 400) {
                const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[90m';
                console.log(`${color}[${moduleName.toUpperCase()} RES] <-- ${res.statusCode} ${url}\x1b[0m`);
                
                // Si l'erreur est grave, on essaie de lire le body
                if (res.statusCode >= 400) {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => console.error(`\x1b[31m[${moduleName.toUpperCase()} BODY] ${body.substring(0, 500)}\x1b[0m`));
                }
            }
        });
        req.on('error', (err) => {
            console.error(`\x1b[31m[${moduleName.toUpperCase()} ERROR] <-- ${url} : ${err.message}\x1b[0m`);
        });
        return req;
    };
};
patchRequest(https, 'https');
patchRequest(http, 'http');

if (global.fetch) {
    const originalFetch = global.fetch;
    global.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : 'unknown fetch');
        console.log(`\x1b[90m[FETCH REQ] --> ${url}\x1b[0m`);
        try {
            const res = await originalFetch.apply(this, args);
            const color = !res.ok ? '\x1b[31m' : '\x1b[90m';
            console.log(`${color}[FETCH RES] <-- ${res.status} ${url}\x1b[0m`);
            if (!res.ok) {
                const clone = res.clone();
                try {
                    const text = await clone.text();
                    console.error(`\x1b[31m[FETCH BODY ERROR] ${text.substring(0, 500)}\x1b[0m`);
                } catch (e) { /* ignore */ }
            }
            return res;
        } catch (err) {
            console.error(`\x1b[31m[FETCH ERROR] <-- ${url} : ${err.message}\x1b[0m`);
            throw err;
        }
    };
}
// --- FIN : Intercepteurs globaux ---

const notion = new Client({ 
    auth: process.env.NOTION_API_KEY,
    logLevel: LogLevel.WARN,
    logger: (level, message, extraInfo) => {
        console.warn(`\x1b[33m[NOTION CLIENT ${level}] ${message}\x1b[0m`, extraInfo ? JSON.stringify(extraInfo) : '');
    }
});
const n2m = new NotionToMarkdown({ notionClient: notion });
const databaseId = process.env.NOTION_DATABASE_ID;

// Fonction utilitaire pour gérer les retries avec délai (Rate Limit)
const withRetry = async (fn, maxRetries = 5, baseDelayMs = 5000) => {
    let attempt = 1;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            const isRateLimit = error.code === 'rate_limited' || error.status === 429 || (error.message && error.message.includes('rate limited'));
            if (isRateLimit) {
                if (attempt >= maxRetries) throw error;
                // Notion renvoie parfois le Retry-After dans les headers
                const retryAfterHeader = error.headers && (error.headers['retry-after'] || error.headers['Retry-After']);
                const delayMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : baseDelayMs * attempt;
                
                console.warn(`\x1b[33m⚠️ Rate limit Notion atteint. Pause de ${delayMs / 1000}s avant la tentative ${attempt + 1}/${maxRetries}...\x1b[0m`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                attempt++;
            } else {
                throw error;
            }
        }
    }
};

// --- NOUVEAU : On apprend à l'outil à lire les colonnes Notion ---
n2m.setCustomTransformer('column_list', async (block) => {
    const { results } = await withRetry(() => notion.blocks.children.list({ block_id: block.id }));
    const mdblocks = await n2m.blocksToMarkdown(results);
    const mdString = n2m.toMarkdownString(mdblocks);
    const content = typeof mdString === 'string' ? mdString : (mdString?.parent || "");
    return `\n<div class="notion-row">\n\n${content}\n\n</div>\n`;
});

n2m.setCustomTransformer('column', async (block) => {
    const { results } = await withRetry(() => notion.blocks.children.list({ block_id: block.id }));
    const mdblocks = await n2m.blocksToMarkdown(results);
    const mdString = n2m.toMarkdownString(mdblocks);
    const content = typeof mdString === 'string' ? mdString : (mdString?.parent || "");
    return `\n<div class="notion-col">\n\n${content}\n\n</div>\n`;
});
const parseYouTubeUrl = (url) => {
    let videoId = '';
    let isShort = false;
    if (url.includes('youtube.com/watch')) {
        try { videoId = new URL(url).searchParams.get('v'); } catch { /* ignore parse error */ }
    } else if (url.includes('youtu.be/')) {
        try { videoId = new URL(url).pathname.substring(1); } catch { /* ignore parse error */ }
    } else if (url.includes('youtube.com/shorts/')) {
        try {
            videoId = new URL(url).pathname.split('/shorts/')[1].split('?')[0];
            isShort = true;
        } catch { /* ignore parse error */ }
    }
    return { videoId, isShort };
};

const renderYouTubeEmbed = (videoId, isShort) => {
    if (isShort) {
        return `\n<div style="max-width: 350px; margin: 40px auto;"><div class="notion-short-wrapper" style="position: relative; width: 100%; padding-bottom: 177.77%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06);"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://www.youtube.com/embed/${videoId}?loop=1&color=white&controls=1&modestbranding=1&playsinline=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>\n`;
    } else {
        return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>\n`;
    }
};

const isNativeVideoUrl = (url) => {
    try {
        const parsed = new URL(url);
        const isCloudflareR2 = parsed.hostname.endsWith('.r2.dev');
        const isVideoExt = /\.(mp4|webm|mov)$/i.test(parsed.pathname);
        return isCloudflareR2 || isVideoExt;
    } catch {
        return false;
    }
};

n2m.setCustomTransformer('video', async (block) => {
    const video = block.video;
    if (!video) {
        console.warn(`\x1b[33m[WARN] Bloc video sans propriété 'video' : ${block.id}\x1b[0m`);
        return '';
    }
    let url = '';
    if (video.type === 'external') {
        url = video.external.url;
    } else if (video.type === 'file') {
        url = video.file.url;
    }

    if (!url) {
        console.warn(`\x1b[33m[WARN] Bloc video sans URL : ${block.id}\x1b[0m`);
        return '';
    }
    console.log(`\x1b[36m[TRANSFORM] Bloc video détecté : ${url}\x1b[0m`);

    // Transformation d'URL pour YouTube
    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const { videoId, isShort } = parseYouTubeUrl(url);
        if (videoId) return renderYouTubeEmbed(videoId, isShort);
    } else if (url.includes('vimeo.com/')) {
        const match = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
        if (match) {
            const videoId = match[1];
            return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    }

    // Vidéo hébergée en direct
    return `\n<div class="notion-video-wrapper" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><video style="width: 100%; display: block;" controls src="${url}"></video></div>\n`;
});

// Ajouter aussi le transformer pour les embeds (quand l'URL est collée comme Intégration / Embed)
n2m.setCustomTransformer('embed', async (block) => {
    const embed = block.embed;
    if (!embed?.url) {
        console.warn(`\x1b[33m[WARN] Bloc embed sans URL : ${block.id}\x1b[0m`);
        return '';
    }
    const url = embed.url;
    console.log(`\x1b[36m[TRANSFORM] Bloc embed détecté : ${url}\x1b[0m`);

    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
        const { videoId, isShort } = parseYouTubeUrl(url);
        if (videoId) return renderYouTubeEmbed(videoId, isShort);
    } else if (url.includes('vimeo.com/')) {
        const match = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
        if (match) {
            const videoId = match[1];
            return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (isNativeVideoUrl(url)) {
        return `\n<div class="notion-video-wrapper" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><video style="width: 100%; display: block;" controls src="${url}"></video></div>\n`;
    }

    // Si on ne sait pas quoi en faire, on affiche au moins le lien
    return `\n<a href="${url}" target="_blank" class="link-act" style="color: var(--provence-violet);">${url}</a>\n`;
});

// Ajouter un transformer pour les bookmarks (favoris web)
n2m.setCustomTransformer('bookmark', async (block) => {
    const bookmark = block.bookmark;
    if (!bookmark?.url) {
        console.warn(`\x1b[33m[WARN] Bloc bookmark sans URL : ${block.id}\x1b[0m`);
        return '';
    }
    const url = bookmark.url;
    console.log(`\x1b[36m[TRANSFORM] Bloc bookmark détecté : ${url}\x1b[0m`);

    if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (isNativeVideoUrl(url)) {
        return `\n<div class="notion-video-wrapper" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><video style="width: 100%; display: block;" controls src="${url}"></video></div>\n`;
    }
    
    return `\n<a href="${url}" target="_blank" class="link-act" style="color: var(--provence-violet);">${url}</a>\n`;
});

// Ajouter un transformer pour les aperçus de liens
n2m.setCustomTransformer('link_preview', async (block) => {
    const link_preview = block.link_preview;
    if (!link_preview?.url) {
        console.warn(`\x1b[33m[WARN] Bloc link_preview sans URL : ${block.id}\x1b[0m`);
        return '';
    }
    const url = link_preview.url;
    console.log(`\x1b[36m[TRANSFORM] Bloc link_preview détecté : ${url}\x1b[0m`);

    if (url.includes('drive.google.com/file/d/')) {
        const match = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url);
        if (match) {
            const fileId = match[1];
            return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
        }
    } else if (isNativeVideoUrl(url)) {
        return `\n<div class="notion-video-wrapper" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><video style="width: 100%; display: block;" controls src="${url}"></video></div>\n`;
    }
    
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


async function downloadNotionImage(page, propertyName, prefix, id, titre) {
    let imageUrl = null;
    if (page.properties[propertyName]?.files?.length > 0) {
        const imgFichier = page.properties[propertyName].files[0];
        const originalUrl = imgFichier.type === 'file' ? imgFichier.file.url : imgFichier.external.url;
        try {
            const ext = originalUrl.split('?')[0].split('.').pop() || 'jpg';
            const localFilename = `${prefix}_${id}.${ext}`;
            const localFilepath = path.join(__dirname, 'img', localFilename);
            console.log(`Téléchargement de l'image ${propertyName} pour ${titre}...`);
            await downloadImage(originalUrl, localFilepath);
            imageUrl = `../img/${localFilename}`;
        } catch (imgError) {
            console.error(`Erreur de téléchargement pour ${propertyName} de ${titre}:`, imgError.message);
            imageUrl = originalUrl;
        }
    }
    return imageUrl;
}

async function processInternalImages(contenuHtml, id, titre) {
    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    const matches = [...contenuHtml.matchAll(imgRegex)];
    let imgIndex = 0;
    for (const match of matches) {
        const originalImgUrl = match[1];
        if (originalImgUrl.startsWith('http')) {
            imgIndex++;
            try {
                const urlObj = new URL(originalImgUrl);
                let ext = urlObj.pathname.split('.').pop();
                if (!ext || ext.length > 4 || !/^[a-zA-Z0-9]+$/.test(ext)) ext = 'jpg';
                const filename = `interne_${id}_${imgIndex}.${ext}`;
                const filepath = path.join(__dirname, 'img', filename);
                console.log(`Téléchargement de l'image interne ${imgIndex} pour l'article ${titre}...`);
                await downloadImage(originalImgUrl, filepath);
                const localUrl = `../img/${filename}`;
                contenuHtml = contenuHtml.split(originalImgUrl).join(localUrl);
            } catch (err) {
                console.error(`Erreur lors du téléchargement de l'image interne ${imgIndex} pour ${titre}:`, err.message);
            }
        }
    }
    return contenuHtml;
}

function processGoogleDriveLinks(contenuHtml) {
    const regex = /<a[^>]*href="(https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)[^"]*)"[^>]*>.*?<\/a>/g;
    return contenuHtml.replaceAll(regex, (match, url, fileId) => {
        return `\n<div class="notion-video-wrapper" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><iframe style="position: absolute; top:0; left:0; width:100%; height:100%; border:none;" src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>\n`;
    });
}

function processNativeVideoLinks(contenuHtml) {
    const regex = /<a[^>]*href="([^"]+)"[^>]*>.*?<\/a>/g;
    return contenuHtml.replaceAll(regex, (match, url) => {
        const decodedUrl = url.replaceAll('&amp;', '&');
        if (isNativeVideoUrl(decodedUrl)) {
            return `\n<div class="notion-video-wrapper" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); margin: 30px 0;"><video style="width: 100%; display: block;" controls src="${url}"></video></div>\n`;
        }
        return match;
    });
}

function checkFailedIntegrations(contenuHtml, titre) {
    const mediaDomains = [
        'youtube.com', 'youtu.be', 'vimeo.com', 'drive.google.com', 
        'spotify.com', 'deezer.com', 'soundcloud.com', 'apple.com'
    ];
    
    const regex = /<a\s+([^>]*\s+)?href="([^"]+)"/gi;
    let match;
    while ((match = regex.exec(contenuHtml)) !== null) {
        const fullTag = match[0];
        const url = match[2];
        
        if (fullTag.includes('social-icon-link')) continue;
        
        let isFailed = false;
        for (const domain of mediaDomains) {
            if (url.includes(domain)) {
                isFailed = true;
                break;
            }
        }

        const decodedUrl = url.replaceAll('&amp;', '&');
        if (!isFailed && isNativeVideoUrl(decodedUrl)) {
            isFailed = true;
        }

        if (isFailed) {
            console.warn(`\x1b[33m⚠️ Attention : Le lien "${url}" dans l'article "${titre}" n'a pas été intégré comme lecteur multimédia/bonus. Il apparaîtra comme un simple lien texte.\x1b[0m`);
        }
    }
}

function groupSocialLinks(contenuHtml) {
    const iconMappings = {
        'instagram': '<i class="fa-brands fa-instagram" style="color: #E1306C; font-size: 1.5em; vertical-align: middle;"></i>',
        'youtube': '<i class="fa-brands fa-youtube" style="color: #FF0000; font-size: 1.5em; vertical-align: middle;"></i>',
        'facebook': '<i class="fa-brands fa-facebook" style="color: #1877F2; font-size: 1.5em; vertical-align: middle;"></i>',
        'tiktok': '<i class="fa-brands fa-tiktok" style="font-size: 1.5em; vertical-align: middle;"></i>',
        'spotify': '<i class="fa-brands fa-spotify" style="color: #1DB954; font-size: 1.5em; vertical-align: middle;"></i>',
        'linktr\\.ee|link[-\\s]*tree': '<i class="fa-solid fa-link" style="color: #43E660; font-size: 1.25em; vertical-align: text-bottom; margin-right: 5px;"></i>',
        'deezer': '<i class="fa-brands fa-deezer" style="font-size: 1.5em; vertical-align: middle;"></i>',
        'apple[-\\s]*podcast': '<i class="fa-solid fa-podcast" style="color: #872EC4; font-size: 1.5em; vertical-align: middle;"></i>',
        'soundcloud': '<i class="fa-brands fa-soundcloud" style="color: #FF5500; font-size: 1.5em; vertical-align: middle;"></i>',
        'siteinternet': '<i class="fa-solid fa-globe" style="color: #0099ffff; font-size: 1.5em; vertical-align: middle;"></i>',
        'bandcamp': '<i class="fa-brands fa-bandcamp" style="color: #007C9E; font-size: 1.5em; vertical-align: middle;"></i>'
    };

    for (const [networkPattern, iconHtml] of Object.entries(iconMappings)) {
        // Suppression du (?:<[^>]+>|\\s)* initial pour ne pas supprimer les marqueurs de fin des liens précédents
        const regex = new RegExp(String.raw`\b(${networkPattern})\b(?:<[^>]+>|\s)*:(?:<[^>]+>|\s)*<a\s+href="([^"]+)"[^>]*>.*?<\/a>`, 'gi');
        contenuHtml = contenuHtml.replaceAll(regex, (match, p1, href) => {
            return `<!--SOCIAL_LINK_START--><a href="${href}" target="_blank" class="social-icon-link" style="display:flex; align-items:center; justify-content:center; width: 44px; height: 44px; background: rgba(255, 255, 255, 0.1); border-radius: 50%; text-decoration:none; transition: all 0.2s ease; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);">${iconHtml}</a><!--SOCIAL_LINK_END-->`;
        });
    }

    // Simplification to avoid high regex complexity: Match blocks of markers.
    // Ajout de (?:<[^>]+>|\s)* À L'INTÉRIEUR du groupe répétable pour lier plusieurs liens séparés par des paragraphes ou espaces
    // eslint-disable-next-line
    const broadRe = /(?:(?:<[^>]+>|\s)*<!--SOCIAL_LINK_START-->.*?<!--SOCIAL_LINK_END-->(?:<[^>]+>|\s)*)+/gi;
    contenuHtml = contenuHtml.replaceAll(broadRe, (match) => {
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
    return contenuHtml;
}

async function pageToArticle(page) {
    const id = page.id;

    const titre = page.properties["Nom"]?.title?.[0]?.plain_text || "Sans titre";
    const date = page.properties["Date"]?.date?.start || "";

    const propCat = page.properties["Catégorie"] || page.properties["Categorie"];
    let categorie = "Article";
    if (propCat?.select) categorie = propCat.select.name;
    else if (propCat?.multi_select?.[0]) categorie = propCat.multi_select[0].name;

    const lien = page.properties["Lien"]?.url || "";

    let image = await downloadNotionImage(page, "Image", "notion", id, titre) || "../img/logo.svg";

    // --- NOUVEAU : Récupération de l'Image Vinyl Personnalisée ---
    let imageVinyl = await downloadNotionImage(page, "Image Vinyl", "vinyl", id, titre);

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
    } else if (mdStringObj?.parent) {
        texteMarkdown = mdStringObj.parent;
    }

    let contenuHtml = marked.parse(texteMarkdown);

    contenuHtml = await processInternalImages(contenuHtml, id, titre);
    contenuHtml = groupSocialLinks(contenuHtml);
    contenuHtml = processGoogleDriveLinks(contenuHtml);
    contenuHtml = processNativeVideoLinks(contenuHtml);

    // --- NOUVEAU : Vérification des liens non intégrés ---
    checkFailedIntegrations(contenuHtml, titre);

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
}

async function fetchNotionData() {
    console.log("\x1b[36m🚀 Démarrage du build Notion...\x1b[0m");
    const startTime = Date.now();
    try {
        console.log("Connexion à Notion en cours...");
        const response = await withRetry(() => notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: 'Date', direction: 'descending' }],
        }));

        const totalArticles = response.results.length;
        console.log(`\x1b[36m📥 ${totalArticles} articles trouvés. Début du traitement séquentiel...\x1b[0m`);

        const articles = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < totalArticles; i++) {
            const page = response.results[i];
            const currentIndex = i + 1;
            const tempTitre = page.properties["Nom"]?.title?.[0]?.plain_text || "Sans titre";
            
            console.log(`\n\x1b[34m[${currentIndex}/${totalArticles}] Traitement de : "${tempTitre}"\x1b[0m`);
            
            try {
                const article = await withRetry(() => pageToArticle(page));
                articles.push(article);
                successCount++;
                console.log(`\x1b[32m✅ Succès : "${tempTitre}" traité sans erreur majeure.\x1b[0m`);
                
                // Délai systématique de courtoisie entre chaque article pour lisser les requêtes
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err) {
                errorCount++;
                console.error(`\x1b[31m❌ Erreur critique sur "${tempTitre}" : ${err.message}\x1b[0m`);
                // L'article est ignoré, mais on continue la boucle !
            }
        }

        const articlesPropres = articles.filter(article => article.titre !== "Sans titre");

        fs.writeFileSync(path.join(__dirname, 'page', 'donnees.json'), JSON.stringify(articlesPropres, null, 2));
        console.log(`\n\x1b[32m💾 Fichier donnees.json généré avec succès avec ${articlesPropres.length} articles valides !\x1b[0m`);

        // --- Bilan de fin ---
        const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n\x1b[35m=========================================\x1b[0m`);
        console.log(`\x1b[32m🎉 Build terminé en ${executionTime}s !\x1b[0m`);
        console.log(`\x1b[36m📊 RÉSUMÉ DU BUILD :\x1b[0m`);
        console.log(`   - Total articles trouvés : ${totalArticles}`);
        console.log(`   - Traités avec succès    : \x1b[32m${successCount}\x1b[0m`);
        if (errorCount > 0) {
            console.log(`   - Échecs (ignorés)       : \x1b[31m${errorCount}\x1b[0m`);
        } else {
            console.log(`   - Échecs (ignorés)       : 0`);
        }
        console.log(`\x1b[35m=========================================\x1b[0m\n`);

    } catch (error) {
        console.error("\x1b[31m❌ ERREUR FATALE GLOBALE (Le build s'est arrêté) :\x1b[0m", error);
        process.exit(1);
    }
}

fetchNotionData();
