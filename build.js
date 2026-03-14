const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const { marked } = require('marked');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });
const databaseId = process.env.NOTION_DATABASE_ID;

async function fetchNotionData() {
    try {
        console.log("Connexion à Notion en cours...");
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: 'Date', direction: 'descending' }],
        });

        // On utilise Promise.all car le script doit "entrer" dans chaque page une par une
        const articles = await Promise.all(response.results.map(async page => {
            const id = page.id; // Identifiant unique indispensable
            
            const titre = page.properties["Nom"]?.title?.[0]?.plain_text || "Sans titre";
            const date = page.properties["Date"]?.date?.start || "";
            
            // Gère la catégorie selon votre réglage Notion
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

            // --- LA MAGIE OPÈRE ICI ---
            // On récupère le contenu écrit DANS la page Notion
            const mdblocks = await n2m.pageToMarkdown(page.id);
            const mdString = n2m.toMarkdownString(mdblocks);
            // On convertit ce texte en vrai code HTML prêt pour le web !
            const contenuHtml = marked.parse(mdString.parent || mdString || "");

            // On ajoute 'id' et 'contenu' à la boîte
            return { id, titre, date, categorie, lien, image, contenu: contenuHtml };
        }));

        fs.writeFileSync('./page/donnees.json', JSON.stringify(articles, null, 2));
        console.log("Fichier donnees.json généré avec le CONTENU des articles !");

    } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
        process.exit(1);
    }
}

fetchNotionData();