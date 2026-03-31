const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const puppeteer = require("puppeteer");

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ─────────────────────────────────────────────
// 🔎 FONCTION DE SCRAPING (Optimisée Cloud)
// ─────────────────────────────────────────────
async function searchHacoo(query) {
  let browser;
  try {
    console.log(`[LOG] Lancement du navigateur pour : "${query}"`);

    browser = await puppeteer.launch({
      headless: "new",
      // Utilise le chemin défini dans les variables Railway ou le défaut Linux
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    
    // Simulation d'un utilisateur réel
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const url = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}&sort=default`;
    
    // On attend que la page charge (timeout 60s pour éviter les erreurs de réseau lent)
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Petit délai pour laisser les images et prix s'afficher
    await new Promise((r) => setTimeout(r, 3500));
    
    // Scroll léger pour charger le contenu dynamique
    await page.evaluate(() => window.scrollBy(0, 500));

    // Extraction des données
    const products = await page.evaluate(() => {
      const results = [];
      // Sélecteurs larges pour s'adapter aux changements de Hacoo
      const cards = document.querySelectorAll(".product-card, .goods-item, [class*='product'], [class*='item']");

      cards.forEach((card) => {
        const titleEl = card.querySelector("h3, h4, [class*='title'], [class*='name']");
        const priceEl = card.querySelector("[class*='price']");
        const imgEl = card.querySelector("img");
        const linkEl = card.querySelector("a");

        if (linkEl && linkEl.href.includes("hacoo.com")) {
          results.push({
            title: titleEl ? titleEl.innerText.trim() : "Produit sans nom",
            price: priceEl ? priceEl.innerText.trim() : "Prix non indiqué",
            image: imgEl?.src || imgEl?.getAttribute("data-src") || null,
            href: linkEl.href,
          });
        }
      });
      return results;
    });

    if (!products || products.length === 0) {
      console.log("[LOG] Aucun produit trouvé sur la page.");
      return null;
    }

    // On prend le premier résultat
    const product = products[0];
    
    // Génération du lien affilié
    const affiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(product.href)}`;

    return {
      title: product.title,
      price: product.price,
      image: product.image,
      affiliateLink: affiliateLink
    };

  } catch (err) {
    console.error("[ERREUR SCRAPING] :", err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log("[LOG] Navigateur fermé.");
    }
  }
}

// ─────────────────────────────────────────────
// 💬 GESTION DES COMMANDES DISCORD
// ─────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "search") {
    const query = interaction.options.getString("query");

    // "Le bot réfléchit..." (nécessaire car le scraping prend > 3s)
    await interaction.deferReply();

    const product = await searchHacoo(query);

    if (!product) {
      return interaction.editReply({ 
        content: `❌ Désolé, je n'ai trouvé aucun résultat pour "**${query}**".` 
      });
    }

    // Création de l'Embed
    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle(product.title.length > 250 ? product.title.slice(0, 247) + "..." : product.title)
      .setURL(product.affiliateLink)
      .setDescription(`💰 **Prix actuel : ${product.price}**`)
      .addFields(
        { name: "🛒 Acheter", value: `[Cliquer ici pour voir sur Hacoo](${product.affiliateLink})` }
      )
      .setFooter({ text: "Hacoo Search Bot • Réponse en temps réel" })
      .setTimestamp();

    if (product.image && product.image.startsWith("http")) {
      embed.setImage(product.image);
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

// ─────────────────────────────────────────────
// 🚀 LANCEMENT DU BOT
// ─────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ Connecté en tant que : ${client.user.tag}`);

  // Enregistrement de la commande /search
  const commands = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Chercher un produit spécifique sur Hacoo")
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("Exemple: Nike Air Force, Veste Tech Fleece...")
          .setRequired(true)
      )
  ];

  try {
    await client.application.commands.set(commands);
    console.log("✅ Commandes Slash enregistrées !");
  } catch (err) {
    console.error("❌ Erreur lors de l'enregistrement des commandes :", err);
  }
});

client.login(TOKEN);
