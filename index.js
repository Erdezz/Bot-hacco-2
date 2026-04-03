const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Ta liste de serveurs
const TELEGRAM_CHANNELS = [
  "hacoolinksydeuxx", "linkscrewfinds", "mkfashionfinds", "hacoolinksvip",
  "HacooFranceLiens", "hacoolinks10chanel", "iammmchannel", "mariehacoo",
  "haccoyeplinks", "hacoolinks", "HacooLinksCarla1"
];

// La base de données temporaire du bot
let productDatabase = [];
let isReadyToSearch = false;

async function performInitialScan() {
  console.log("🚀 Lancement du scan initial de tous les canaux...");
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: '/usr/bin/google-chrome-stable',
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    for (const channel of TELEGRAM_CHANNELS) {
      console.log(`📡 Scan de @${channel}...`);
      try {
        await page.goto(`https://t.me/s/${channel}`, { waitUntil: "networkidle2", timeout: 40000 });
        
        // On scrolle 3 fois pour chaque canal au début
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollTo(0, -5000));
          await new Promise(r => setTimeout(r, 1000));
        }

        const found = await page.evaluate(() => {
          const messages = document.querySelectorAll(".tgme_widget_message");
          const results = [];
          messages.forEach(msg => {
            const text = msg.innerText;
            const linkEl = msg.querySelector('a[href*="hacoo"], a[href*="onlyaff"], a[href*="link"]');
            const imgStyle = msg.querySelector(".tgme_widget_message_photo_wrap")?.getAttribute("style");
            const img = imgStyle ? imgStyle.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] : null;

            if (linkEl && linkEl.href) {
              results.push({
                title: text.split('\n')[0].substring(0, 150),
                fullText: text.toLowerCase(),
                link: linkEl.href,
                image: img
              });
            }
          });
          return results;
        });
        
        productDatabase.push(...found);
      } catch (e) { console.log(`Erreur sur ${channel}: ${e.message}`); }
    }

    // Nettoyage des doublons
    productDatabase = Array.from(new Map(productDatabase.map(item => [item.link, item])).values());
    
    isReadyToSearch = true;
    console.log(`✅ Scan terminé ! ${productDatabase.length} produits en mémoire.`);
    
    // Message optionnel dans un salon spécifique (remplace ID_SALON par l'id de ton salon log)
    const logChannel = client.channels.cache.get("1346455532481072398"); // Mets ton ID ici
    if (logChannel) logChannel.send(`✅ **Base de données Hacoo prête !** ${productDatabase.length} articles indexés.`);

  } catch (e) { console.error("Erreur scan:", e); }
  finally { if (browser) await browser.close(); }
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.commandName === "search") {
    if (!isReadyToSearch) {
      return interaction.reply({ content: "⏳ Le bot est encore en train de scanner les canaux Telegram au démarrage. Réessaie dans 2 minutes.", ephemeral: true });
    }

    const query = interaction.options.getString("query").toLowerCase();
    // On cherche dans notre base de données locale (très rapide !)
    const results = productDatabase.filter(p => p.fullText.includes(query)).slice(0, 10);

    if (results.length === 0) {
      return interaction.reply(`❌ Aucun article trouvé pour "**${query}**" dans ma base de données actuelle.`);
    }

    const embeds = results.map(res => {
      const affLink = `https://c.onlyaff.app/?url=${encodeURIComponent(res.link)}`;
      return new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(res.title)
        .setURL(affLink)
        .setImage(res.image)
        .setFooter({ text: "Source: Telegram Scanner" });
    });

    await interaction.reply({ content: `✅ Voici les résultats pour : **${query}**`, embeds: embeds });
  }
});

client.once("ready", async () => {
  const cmd = [
    new SlashCommandBuilder()
      .setName("search")
      .setDescription("Recherche instantanée dans la base Hacoo")
      .addStringOption(o => o.setName("query").setDescription("Ex: Nike, Kayano...").setRequired(true))
  ];
  await client.application.commands.set(cmd);
  console.log("🤖 Bot en ligne, démarrage du scan...");
  
  // Lancement du scan au démarrage
  performInitialScan();
});

client.login(process.env.DISCORD_TOKEN);
