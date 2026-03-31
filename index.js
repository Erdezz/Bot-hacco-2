const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");
const puppeteer = require("puppeteer");

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;

// ─────────────────────────────────────────────
// DISCORD CLIENT
// ─────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ─────────────────────────────────────────────
// 🔎 SCRAPING HACOO
// ─────────────────────────────────────────────
async function searchHacoo(query) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  });

  const page = await browser.newPage();

  // Simuler un vrai navigateur
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  try {
    const url = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}&sort=default`;

    console.log(`[SEARCH] URL: ${url}`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Attendre que les produits soient chargés
    await new Promise((r) => setTimeout(r, 4000));

    // Scroll pour déclencher le lazy loading
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise((r) => setTimeout(r, 2000));

    // Extraire les produits
    const products = await page.evaluate(() => {
      const results = [];

      // Sélecteurs possibles selon la structure Hacoo
      const cards = document.querySelectorAll(
        ".product-card, .goods-item, .item-card, .search-item, [class*='product'], [class*='goods'], [class*='item']"
      );

      cards.forEach((card) => {
        // Titre
        const titleEl = card.querySelector(
          ".product-title, .goods-name, .item-title, .title, h3, h4, [class*='title'], [class*='name']"
        );
        const title = titleEl ? titleEl.innerText.trim() : null;

        // Prix
        const priceEl = card.querySelector(
          ".price, .goods-price, .item-price, [class*='price']"
        );
        const price = priceEl ? priceEl.innerText.trim() : null;

        // Image
        const imgEl = card.querySelector("img");
        const image =
          imgEl?.src ||
          imgEl?.getAttribute("data-src") ||
          imgEl?.getAttribute("data-lazy") ||
          null;

        // Lien produit
        const linkEl = card.querySelector("a");
        const href = linkEl ? linkEl.href : null;

        if (href && href.includes("hacoo.com")) {
          results.push({ title, price, image, href });
        }
      });

      // Fallback : tous les liens avec "item" ou "product" dans l'URL
      if (results.length === 0) {
        document.querySelectorAll("a").forEach((a) => {
          const href = a.href;
          if (
            href &&
            (href.includes("/item/") ||
              href.includes("/product/") ||
              href.includes("/goods/"))
          ) {
            const imgEl = a.querySelector("img");
            const titleEl = a.querySelector(
              "[class*='title'], [class*='name'], h3, h4, p"
            );
            const priceEl = a.querySelector("[class*='price']");

            results.push({
              title: titleEl ? titleEl.innerText.trim() : a.title || a.innerText.trim().substring(0, 80),
              price: priceEl ? priceEl.innerText.trim() : null,
              image:
                imgEl?.src || imgEl?.getAttribute("data-src") || null,
              href,
            });
          }
        });
      }

      return results;
    });

    await browser.close();

    console.log(`[SEARCH] ${products.length} produits trouvés`);

    if (!products.length) return null;

    // Prendre le premier produit valide avec un titre
    const product = products.find((p) => p.title && p.title.length > 2) || products[0];

    // Construire le lien affilié
    // On encode l'URL Hacoo dans le paramètre du lien affilié
    const affiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(product.href)}`;

    return {
      title: product.title || "Produit Hacoo",
      price: product.price || "Prix non disponible",
      image: product.image || null,
      originalLink: product.href,
      affiliateLink,
    };
  } catch (err) {
    await browser.close();
    console.error("[ERREUR SCRAPING]", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 💬 GESTION DES COMMANDES
// ─────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "search") {
    const query = interaction.options.getString("query");

    // Defer pour éviter le timeout Discord (>3s)
    await interaction.deferReply();

    console.log(`[COMMANDE] /search "${query}"`);

    const product = await searchHacoo(query);

    if (!product) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Aucun produit trouvé")
        .setDescription(
          `Aucun résultat pour **${query}** sur Hacoo.\nEssaie avec d'autres mots-clés.`
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Construire l'embed complet
    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle(product.title.length > 256 ? product.title.substring(0, 253) + "..." : product.title)
      .setURL(product.affiliateLink)
      .setDescription(`💰 **Prix : ${product.price}**`)
      .addFields(
        {
          name: "🔗 Lien affilié",
          value: `[Voir sur Hacoo](${product.affiliateLink})`,
          inline: false,
        }
      )
      .setFooter({
        text: "Hacoo Bot • Résultats en temps réel",
        iconURL: "https://www.hacoo.com/favicon.ico",
      })
      .setTimestamp();

    // Ajouter l'image si disponible
    if (product.image && product.image.startsWith("http")) {
      embed.setImage(product.image);
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

// ─────────────────────────────────────────────
// 🚀 BOT READY + ENREGISTREMENT COMMANDES
// ─────────────────────────────────────────────
client.once("ready", async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("🔎 Chercher un produit sur Hacoo")
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("Ex: nike air force, veste north face, jordan 1...")
          .setRequired(true)
      )
      .toJSON(),
  ];

  try {
    await client.application.commands.set(commands);
    console.log("✅ Commandes slash enregistrées");
  } catch (err) {
    console.error("❌ Erreur enregistrement commandes:", err);
  }
});

// ─────────────────────────────────────────────
// ▶️ LANCEMENT
// ─────────────────────────────────────────────
client.login(TOKEN);
