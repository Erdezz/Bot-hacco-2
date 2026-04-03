const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function searchHacoo(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome-stable', 
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    // Recherche globale
    const searchUrl = `https://www.hacoo.com/search?keywords=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 4000));

    const product = await page.evaluate(() => {
      const card = document.querySelector(".product-card, .goods-item, [class*='product']");
      if (!card) return null;
      
      return {
        title: card.querySelector("h3, h4, [class*='title']")?.innerText.trim() || "Produit Hacoo",
        price: card.querySelector("[class*='price']")?.innerText.trim() || "Prix inconnu",
        image: card.querySelector("img")?.src || null,
        href: card.querySelector("a")?.href || null,
      };
    });

    if (!product || !product.href) return null;

    // Ton lien d'affiliation personnalisé
    const affiliateLink = `https://c.onlyaff.app/?url=${encodeURIComponent(product.href)}`;

    return { ...product, affiliateLink };
  } catch (e) { 
    console.error(e); 
    return null; 
  } finally { 
    if (browser) await browser.close(); 
  }
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.commandName === "search") {
    await interaction.deferReply();
    const res = await searchHacoo(interaction.options.getString("query"));
    
    if (!res) return interaction.editReply("❌ Aucun lien trouvé pour cette recherche.");

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle(res.title)
      .setURL(res.affiliateLink)
      .setDescription(`💰 **${res.price}**\n\n[Clique ici pour voir l'article](${res.affiliateLink})`);
    
    if (res.image) embed.setImage(res.image);
    
    await interaction.editReply({ embeds: [embed] });
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
  console.log("✅ Bot Hacoo Connecté !");
});

client.login(process.env.DISCORD_TOKEN);
