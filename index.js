const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function searchHacoo(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      // Chemin impératif pour l'image Docker Railway
      executablePath: '/usr/bin/google-chrome-stable', 
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    // Recherche globale sur Hacoo
    const searchUrl = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}&sort=default`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    
    // On attend que les produits se chargent (4 secondes)
    await new Promise(r => setTimeout(r, 4000));

    const results = await page.evaluate(() => {
      // On récupère tous les éléments de produits possibles
      const cards = document.querySelectorAll(".product-card, .goods-item, [class*='product'], [class*='item']");
      const found = [];

      cards.forEach(card => {
        const linkEl = card.querySelector("a");
        const titleEl = card.querySelector("h3, h4, [class*='title']");
        const imgEl = card.querySelector("img");
        const priceEl = card.querySelector("[class*='price']");

        if (linkEl && linkEl.href.includes("hacoo.com")) {
          found.push({
            title: titleEl?.innerText.trim() || "Produit Hacoo",
            price: priceEl?.innerText.trim() || "Prix variable",
            image: imgEl?.src || null,
            href: linkEl.href,
          });
        }
      });
      return found;
    });

    if (!results || results.length === 0) return null;

    // On prend le premier résultat pertinent et on génère ton lien affilié
    const product = results[0];
    const finalAffiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(product.href)}`;

    return { ...product, affiliateLink: finalAffiliateLink };

  } catch (e) { 
    console.error("Erreur de recherche:", e); 
    return null; 
  } finally { 
    if (browser) await browser.close(); 
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "search") {
    const query = interaction.options.getString("query");
    
    // On prévient Discord que la recherche est en cours (scraping long)
    await interaction.deferReply();

    const res = await searchHacoo(query);

    if (!res) {
      return interaction.editReply(`❌ Aucun résultat trouvé pour "**${query}**".`);
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setTitle(`🔎 Résultat Hacoo : ${query}`)
      .setDescription(`**${res.title}**\n💰 Prix : ${res.price}\n\n🔗 **Lien :** ${res.affiliateLink}`)
      .setURL(res.affiliateLink)
      .setTimestamp();

    if (res.image) embed.setImage(res.image);

    await interaction.editReply({ embeds: [embed] });
  }
});

client.once("ready", async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Cherche un produit sur Hacoo et génère le lien")
      .addStringOption(option => 
        option.setName("query")
          .setDescription("L'objet à chercher (ex: saucony, nike...)")
          .setRequired(true))
  ];

  await client.application.commands.set(commands);
  console.log(`✅ Bot en ligne ! Prêt à chercher sur Hacoo.`);
});

client.login(process.env.DISCORD_TOKEN);
