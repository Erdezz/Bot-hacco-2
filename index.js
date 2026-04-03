const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function searchHacooMulti(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome-stable', 
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    const searchUrl = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    
    // On attend que les images et produits se chargent
    await new Promise(r => setTimeout(r, 5000));

    const products = await page.evaluate(() => {
      // On cherche tous les conteneurs de produits
      const cards = document.querySelectorAll(".product-card, .goods-item, [class*='product']");
      const results = [];

      cards.forEach((card, index) => {
        if (index >= 10) return; // On s'arrête à 10 maximum

        const title = card.querySelector("h3, h4, [class*='title']")?.innerText.trim();
        const price = card.querySelector("[class*='price']")?.innerText.trim();
        const img = card.querySelector("img")?.src;
        const link = card.querySelector("a")?.href;

        if (link && link.includes("hacoo.com")) {
          results.push({ title, price, img, link });
        }
      });
      return results;
    });

    return products;
  } catch (e) { 
    console.error(e); 
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
      return interaction.editReply(`❌ Aucun résultat trouvé pour "**${query}**".`);
    }

    const embeds = results.map(res => {
      const affiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(res.link)}`;
      
      return new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle(res.title || "Produit Hacoo")
        .setURL(affiliateLink)
        .addFields({ name: 'Prix', value: res.price || "Voir sur le site", inline: true })
        .setImage(res.img)
        .setFooter({ text: "Lien d'affiliation généré" });
    });

    // Discord limite à 10 embeds par message
    await interaction.editReply({ 
      content: `✅ Voici les 10 meilleurs résultats pour : **${query}**`,
      embeds: embeds.slice(0, 10) 
    });
  }
});

client.once("ready", async () => {
  const cmd = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Chercher 10 produits sur Hacoo")
      .addStringOption(o => o.setName("query").setDescription("Produit à chercher").setRequired(true))
  ];
  await client.application.commands.set(cmd);
  console.log("✅ Bot Hacoo Multi-Liens Connecté !");
});

client.login(process.env.DISCORD_TOKEN);
