const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TELEGRAM_CHANNELS = [
  "hacoolinksydeuxx", "linkscrewfind", "mkfashionfinds", "hacoolinksvip",
  "HacooFranceLiens", "hacoolinks10chanel", "iammmchannel", "mariehacoo",
  "haccoyeplinks", "hacoolinks", "HacooLinksCarla1"
];

// --- CONFIGURATION ---
const MY_SERVER_ID = "1451672186355060788"; // ⚠️ METS TON ID ICI
let productDatabase = [];
let isReadyToSearch = false;

async function performInitialScan() {
    console.log("🚀 Lancement du scan TOTAL...");
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: '/usr/bin/google-chrome-stable',
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        });

        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        for (const channel of TELEGRAM_CHANNELS) {
            console.log(`📡 Extraction de : @${channel}`);
            try {
                await page.goto(`https://t.me/s/${channel}`, { waitUntil: "networkidle2", timeout: 60000 });
                await page.waitForSelector(".tgme_widget_message", { timeout: 15000 }).catch(() => {});

                let previousHeight = 0;
                let scrollAttempts = 0;
                const maxScrolls = 50; 

                while (scrollAttempts < maxScrolls) {
                    const currentHeight = await page.evaluate(() => {
                        window.scrollTo(0, -100000);
                        return document.body.scrollHeight;
                    });
                    await new Promise(r => setTimeout(r, 2500)); 
                    if (currentHeight === previousHeight) break;
                    previousHeight = currentHeight;
                    scrollAttempts++;
                }

                const found = await page.evaluate(() => {
                    const messages = document.querySelectorAll(".tgme_widget_message");
                    const data = [];
                    messages.forEach(msg => {
                        const text = msg.innerText || "";
                        const links = Array.from(msg.querySelectorAll('a[href]'));
                        const productLink = links.find(a => /hacoo|onlyaff|c\.link|s\.click|t\.ly/.test(a.href) && !a.href.includes('t.me/s/'));
                        const imgEl = msg.querySelector(".tgme_widget_message_photo_wrap");
                        let imgUrl = null;
                        if (imgEl) {
                            const style = imgEl.getAttribute("style");
                            const match = style ? style.match(/url\(['"]?([^'"]+)['"]?\)/) : null;
                            imgUrl = match ? match[1] : null;
                        }
                        if (productLink) {
                            data.push({
                                title: text.split('\n')[0].trim().substring(0, 80) || "Produit Hacoo",
                                fullText: text.toLowerCase(),
                                link: productLink.href,
                                image: imgUrl
                            });
                        }
                    });
                    return data;
                });

                productDatabase.push(...found);
                console.log(`✅ @${channel} : ${found.length} liens.`);
            } catch (err) { console.log(`❌ Erreur @${channel}: ${err.message}`); }
        }

        productDatabase = Array.from(new Map(productDatabase.map(item => [item.link, item])).values())
                               .filter(item => item.link.startsWith('http'));

        isReadyToSearch = true;
        console.log(`\n💎 SCAN TERMINÉ ! Total : ${productDatabase.length}`);

        const logChannel = client.channels.cache.get("1346455532481072398");
        if (logChannel) {
            logChannel.send(`✅ **Base de données prête !** \`${productDatabase.length}\` articles indexés.`);
        }

    } catch (e) { console.error("Erreur scan:", e); }
    finally { if (browser) await browser.close(); }
}

// --- COMMANDE UNIQUE ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // 1. SÉCURITÉ PRIVÉ
    if (interaction.guildId !== MY_SERVER_ID) {
        return interaction.reply({ 
            content: "❌ Ce bot est privé. Vous n'avez pas l'autorisation d'utiliser cette commande ici.", 
            ephemeral: true 
        });
    }

    // 2. LOGIQUE DE RECHERCHE
    if (interaction.commandName === "search") {
        if (!isReadyToSearch) {
            return interaction.reply({ content: "⏳ Scan en cours... Réessaie dans quelques minutes.", ephemeral: true });
        }

        const query = interaction.options.getString("query").toLowerCase();
        const keywords = query.split(" ");
        const results = productDatabase.filter(p => keywords.every(word => p.fullText.includes(word))).slice(0, 10);

        if (results.length === 0) {
            return interaction.reply(`❌ Aucun article trouvé pour "**${query}**".`);
        }

        const embeds = results.map(res => {
            return new EmbedBuilder()
                .setColor("#2f3136")
                .setTitle(res.title)
                .setURL(res.link)
                .setImage(res.image)
                .setDescription(`🔗 [Lien direct vers l'article](${res.link})`)
                .setFooter({ text: "Hacoo Finder Pro" });
        });

        await interaction.reply({ content: `🔍 **Résultats pour :** _${query}_`, embeds: embeds });
    }
});

client.once("ready", async () => {
    const cmd = [
        new SlashCommandBuilder()
            .setName("search")
            .setDescription("Recherche un produit")
            .addStringOption(o => o.setName("query").setDescription("Ex: Nike, Ralph...").setRequired(true))
    ];
    await client.application.commands.set(cmd);
    console.log(`Bot connecté : ${client.user.tag}`);
    performInitialScan();
});

client.login(process.env.DISCORD_TOKEN);
