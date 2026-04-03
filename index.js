const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TELEGRAM_CHANNELS = [
  "hacoolinksydeuxx", "linkscrewfinds", "mkfashionfinds", "hacoolinksvip",
  "HacooFranceLiens", "hacoolinks10chanel", "iammmchannel", "mariehacoo",
  "haccoyeplinks", "hacoolinks", "HacooLinksCarla1"
];

let productDatabase = [];
let isReadyToSearch = false;

async function performInitialScan() {
    console.log("🚀 Lancement du scan intensif...");
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/google-chrome-stable',
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        });

        const page = await browser.newPage();
        // User agent réaliste pour éviter le flag
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        for (const channel of TELEGRAM_CHANNELS) {
            console.log(`📡 Scan profond de @${channel}...`);
            try {
                await page.goto(`https://t.me/s/${channel}`, { waitUntil: "networkidle2", timeout: 60000 });
                
                // On simule plusieurs scrolls pour charger l'historique (Telegram Web en charge environ 20 par scroll)
                for (let i = 0; i < 8; i++) { 
                    await page.evaluate(() => window.scrollTo(0, -10000));
                    await new Promise(r => setTimeout(r, 1500)); // Pause pour laisser charger
                }

                const found = await page.evaluate(() => {
                    const messages = document.querySelectorAll(".tgme_widget_message");
                    const results = [];
                    messages.forEach(msg => {
                        const text = msg.innerText;
                        // On cherche les liens Hacoo ou affiliés
                        const linkEl = msg.querySelector('a[href*="hacoo"], a[href*="onlyaff"], a[href*="link"]');
                        const imgStyle = msg.querySelector(".tgme_widget_message_photo_wrap")?.getAttribute("style");
                        const img = imgStyle ? imgStyle.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] : null;

                        if (linkEl && linkEl.href && !linkEl.href.includes('t.me')) {
                            results.push({
                                title: text.split('\n')[0].substring(0, 100) || "Produit sans titre",
                                fullText: text.toLowerCase(),
                                link: linkEl.href,
                                image: img
                            });
                        }
                    });
                    return results;
                });
                
                productDatabase.push(...found);
                console.log(`✅ ${found.length} items récupérés sur @${channel}`);
            } catch (e) { console.log(`❌ Erreur sur ${channel}: ${e.message}`); }
        }

        // Nettoyage : suppression des doublons basés sur le lien
        const uniqueProducts = Array.from(new Map(productDatabase.map(item => [item.link, item])).values());
        productDatabase = uniqueProducts;
        
        isReadyToSearch = true;
        console.log(`\n✨ Scan terminé ! ${productDatabase.length} produits uniques en mémoire.`);
        
        const logChannel = client.channels.cache.get("1346455532481072398");
        if (logChannel) logChannel.send(`✅ **Base de données prête !**\n📦 Articles indexés : \`${productDatabase.length}\``);

    } catch (e) { console.error("Erreur critique scan:", e); }
    finally { if (browser) await browser.close(); }
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "search") {
        if (!isReadyToSearch) {
            return interaction.reply({ content: "⏳ Le bot finit de scanner Telegram. Réessaie dans une minute !", ephemeral: true });
        }

        const query = interaction.options.getString("query").toLowerCase();
        // Recherche multi-mots : on vérifie que chaque mot de la requête est présent
        const keywords = query.split(" ");
        const results = productDatabase.filter(p => 
            keywords.every(word => p.fullText.includes(word))
        ).slice(0, 5); // Limité à 5 pour ne pas faire de trop gros messages

        if (results.length === 0) {
            return interaction.reply(`❌ Aucun article trouvé pour "**${query}**".`);
        }

        const embeds = results.map(res => {
            return new EmbedBuilder()
                .setColor("#FF4500")
                .setTitle(res.title)
                .setURL(res.link)
                .setImage(res.image)
                .setDescription(`[Clique ici pour voir le produit](${res.link})`)
                .setFooter({ text: "Hacoo Finder • Rapid Search" });
        });

        await interaction.reply({ content: `🔎 **${results.length} résultats trouvés :**`, embeds: embeds });
    }
});

client.once("ready", async () => {
    const cmd = [
        new SlashCommandBuilder()
            .setName("search")
            .setDescription("Recherche instantanée dans les liens Hacoo")
            .addStringOption(o => o.setName("query").setDescription("Ex: Nike TN, Ralph Lauren...").setRequired(true))
    ];
    await client.application.commands.set(cmd);
    console.log(`Logged in as ${client.user.tag}`);
    performInitialScan();
});

client.login(process.env.DISCORD_TOKEN);
