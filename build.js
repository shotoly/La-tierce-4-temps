const { Client } = require('@notionhq/client');
const fs = require('fs');

// Initialisation du client Notion avec votre clé secrète (qui sera fournie par Render)
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

async function fetchNotionData() {
    try {
        console.log("Connexion à Notion en cours...");
        const response = await notion.databases.query({
            database_id: databaseId,
            // Optionnel : Trier par date de la plus récente à la plus ancienne
            sorts: [{ property: 'Date', direction: 'descending' }],
        });

        // Transformer les données complexes de Notion en un tableau simple
        const articles = response.results.map(page => {
            // Ces lignes extraient les infos de vos colonnes Notion. 
            // Attention : les noms entre guillemets ("Nom", "Date", "Catégorie"...) doivent correspondre EXACTEMENT aux noms de vos colonnes dans Notion.
            const titre = page.properties.Nom.title[0]?.plain_text || "Sans titre";
            const date = page.properties.Date.date?.start || "";
            const categorie = page.properties.Catégorie.select?.name || "Article";
            const lien = page.properties.Lien.url || "#";
            
            // Gestion de l'image (fichier uploadé directement sur Notion ou lien externe)
            let image = "../img/logo.svg"; // image par défaut si vide
            if (page.properties.Image.files && page.properties.Image.files.length > 0) {
                const imgFichier = page.properties.Image.files[0];
                image = imgFichier.type === 'file' ? imgFichier.file.url : imgFichier.external.url;
            }

            return { titre, date, categorie, lien, image };
        });

        // Sauvegarder ce tableau dans le fichier donnees.json que votre page web lira
        fs.writeFileSync('./page/donnees.json', JSON.stringify(articles, null, 2));
        console.log("Fichier donnees.json généré avec succès !");

    } catch (error) {
        console.error("Erreur lors de la récupération des données de Notion :", error);
        process.exit(1); // Fait échouer le déploiement Render si Notion plante
    }
}

fetchNotionData();