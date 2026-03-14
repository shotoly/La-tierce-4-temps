const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { marked } = require('marked');
const fs = require('fs');

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
// -----------------------------------------------------------------

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
                image = imgFichier.type === 'file' ? imgFichier.file.url : imgFichier.external.url;
            }

            // Récupération du fichier Audio
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

            const contenuHtml = marked.parse(texteMarkdown);

            return { id, titre, date, categorie, lien, image, audio: audioUrl, contenu: contenuHtml };
        }));

        const articlesPropres = articles.filter(article => article.titre !== "Sans titre");

        fs.writeFileSync('./page/donnees.json', JSON.stringify(articlesPropres, null, 2));
        console.log("Fichier donnees.json généré avec le CONTENU des articles !");

    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        process.exit(1);
    }
}

fetchNotionData();
