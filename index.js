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

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ─────────────────────────────────────────────
// 🔎 SCRAPING HACOO
// ─────────────────────────────────────────────
async function searchHacoo(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      // Cette ligne permet d'utiliser le Chrome installé par Railway
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const url = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}&sort=default`;
    console.log(`[SEARCH] Tentative sur : ${url}`);

    // Augmentation du timeout pour les serveurs parfois lents
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await new Promise((r) => setTimeout(r, 3000));
    await page.evaluate(() => window.scrollBy(0, 500));

    const products = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(".product-card, .goods-item, [class*='product'], [class*='item']");

      cards.forEach((card) => {
        const titleEl = card.querySelector("h3, h4, [class*='title'], [class*='name']");
        const priceEl = card.querySelector("[class*='price']");
        const imgEl = card.querySelector("img");
        const linkEl = card.querySelector("a");

        if (linkEl && linkEl.href.includes("hacoo.com")) {
          results.push({
            title: titleEl ? titleEl.innerText.trim() : "Produit sans nom",
            price: priceEl ? priceEl.innerText.trim() : "Voir prix",
            image: imgEl?.src || imgEl?.getAttribute("data-src") || null,
            href: linkEl.href,
          });
        }
      });
      return results;
    });

    if (!products.length) return null;

    const product = products[0];
    const affiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(product.href)}`;

    return { ...product, affiliateLink };

  } catch (err) {
    console.error("[ERREUR SCRAPING]", err.message);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

// ─────────────────────────────────────────────
// 💬 GESTION DES COMMANDES
// ─────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "search") {
    const query = interaction.options.getString("query");

    await interaction.deferReply();

    const product = await searchHacoo(query);

    if (!product) {
      return interaction.editReply({ 
        content: `❌ Aucun résultat pour "**${query}**". Réessaie plus tard.` 
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle(product.title.slice(0, 250))
      .setURL(product.affiliateLink)
      .setDescription(`💰 **Prix : ${product.price}**`)
      .addFields({ name: "🔗 Lien", value: `[Commander sur Hacoo](${product.affiliateLink})` })
      .setFooter({ text: "Hacoo Bot" })
      .setTimestamp();

    if (product.image?.startsWith("http")) {
      embed.setImage(product.image);
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

client.once("ready", async () => {
  console.log(`✅ Bot en ligne : ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Chercher un produit sur Hacoo")
      .addStringOption(opt => opt.setName("query").setDescription("Le produit à chercher").setRequired(true))
  ];
  await client.application.commands.set(commands);
});

client.login(TOKEN);
