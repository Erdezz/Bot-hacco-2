const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Ta liste de 20 serveurs (tu peux en ajouter d'autres ici)
const TELEGRAM_CHANNELS = [
  "hacoolinksydeuxx", "linkscrewfinds", "mkfashionfinds", "hacoolinksvip",
  "HacooFranceLiens", "hacoolinks10chanel", "iammmchannel", "mariehacoo",
  "haccoyeplinks", "hacoolinks", "HacooLinksCarla1", "hacoolinks10chanel"
];

async function scanTelegram(query) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome-stable',
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    let allResults = [];

    // On parcourt les serveurs (on en prend 5 au hasard par recherche pour éviter les timeouts)
    const shuffled = TELEGRAM_CHANNELS.sort(() => 0.5 - Math.random()).slice(0, 5);

    for (const channel of shuffled) {
      console.log(`🔎 Scan du canal : ${channel}`);
      await page.goto(`https://t.me/s/${channel}`, { waitUntil: "networkidle2", timeout: 30000 });
      
      const found = await page.evaluate((searchQuery) => {
        const messages = document.querySelectorAll(".tgme_widget_message");
        const matches = [];
        
        messages.forEach(msg => {
          const text = msg.innerText.toLowerCase();
          // On vérifie si le message contient ton mot-clé (ex: "nike")
          if (text.includes(searchQuery.toLowerCase())) {
            const link = msg.querySelector('a[href*="hacoo"], a[href*="onlyaff"]')?.href;
            const imgStyle = msg.querySelector(".tgme_widget_message_photo_wrap")?.getAttribute("style");
            const img = imgStyle ? imgStyle.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] : null;

            if (link) {
              matches.push({
                title: text.split('\n')[0].substring(0, 100),
                link: link,
                image: img
              });
            }
          }
        });
        return matches;
      }, query);

      allResults.push(...found);
      if (allResults.length >= 10) break;
    }

    return allResults.slice(0, 10);
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
    
    const results = await scanTelegram(query);
    
    if (results.length === 0) {
      return interaction.editReply(`❌ Aucun lien trouvé pour "**${query}**" dans les serveurs Telegram.`);
    }

    const embeds = results.map(res => {
      const affLink = `https://c.onlyaff.app/?url=${encodeURIComponent(res.link)}`;
      return new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(res.title)
        .setURL(affLink)
        .setDescription(`🔗 [Clique ici pour le lien Hacoo](${affLink})`)
        .setImage(res.image);
    });

    await interaction.editReply({ 
      content: `✅ J'ai scanné les serveurs ! Voici les résultats pour : **${query}**`,
      embeds: embeds 
    });
  }
});

client.once("ready", async () => {
  const cmd = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Scanne 20 serveurs Telegram pour un produit")
      .addStringOption(o => o.setName("query").setDescription("Produit (ex: Nike)").setRequired(true))
  ];
  await client.application.commands.set(cmd);
  console.log("✅ Bot Scanner Telegram prêt !");
});

client.login(process.env.DISCORD_TOKEN);
