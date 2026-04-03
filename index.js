const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function searchHacooMulti(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome-stable', 
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled" // Cache le robot
      ]
    });
    
    const page = await browser.newPage();
    
    // On se fait passer pour un vrai utilisateur
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9' });

    const searchUrl = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}`;
    
    // On augmente le timeout pour les connexions lentes de Railway
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 90000 });
    
    // On attend qu'un élément de produit apparaisse (on teste plusieurs sélecteurs)
    try {
        await page.waitForSelector('.product-card, .goods-item, [class*="item"]', { timeout: 10000 });
    } catch (e) {
        console.log("Les sélecteurs classiques n'ont pas été trouvés, tentative d'extraction brute...");
    }

    // Scroll un peu pour forcer le chargement des images
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 3000));

    const products = await page.evaluate(() => {
      // On cherche TOUS les liens qui ressemblent à des produits
      const results = [];
      const items = document.querySelectorAll('a[href*="/product/"], .product-card, .goods-item');

      items.forEach((item) => {
        if (results.length >= 10) return;

        // On cherche le lien, le titre et l'image à l'intérieur ou sur l'élément lui-même
        const link = item.href || item.querySelector('a')?.href;
        const title = item.querySelector('h3, h4, [class*="title"], img[alt]')?.innerText || item.querySelector('img')?.alt;
        const img = item.querySelector('img')?.src;
        const price = item.querySelector('[class*="price"]')?.innerText;

        if (link && !results.find(r => r.link === link)) {
          results.push({
            title: title || "Produit Hacoo",
            price: price || "Voir prix",
            img: img || "",
            link: link
          });
        }
      });
      return results;
    });

    return products;
  } catch (e) { 
    console.error("Erreur Scraping:", e); 
    return []; 
  } finally { 
    if (browser) await browser.close(); 
  }
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.commandName === "search") {
    await interaction.deferReply();
    const query = interaction.options.getString("query");
    
    const results = await searchHacooMulti(query);
    
    if (!results || results.length === 0) {
      return interaction.editReply(`❌ Aucun résultat trouvé pour "**${query}**". Réessaie dans quelques instants.`);
    }

    const embeds = results.slice(0, 10).map(res => {
      const affiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(res.link)}`;
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle(res.title.substring(0, 250))
        .setURL(affiliateLink)
        .setDescription(`💰 **Prix : ${res.price}**\n[Lien direct](${affiliateLink})`);
      
      if (res.img && res.img.startsWith('http')) embed.setThumbnail(res.img);
      return embed;
    });

    await interaction.editReply({ 
      content: `✅ J'ai trouvé **${results.length}** articles pour : **${query}**`,
      embeds: embeds 
    });
  }
});

client.once("ready", async () => {
  const cmd = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Chercher sur Hacoo")
      .addStringOption(o => o.setName("query").setDescription("Produit").setRequired(true))
  ];
  await client.application.commands.set(cmd);
  console.log("✅ Bot Hacoo Connecté et Amélioré !");
});

client.login(process.env.DISCORD_TOKEN);
