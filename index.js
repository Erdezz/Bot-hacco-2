const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const puppeteer = require("puppeteer");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TELEGRAM_CHANNELS = [
  "hacoolinksydeuxx", "linkcrewfinds", "mkfashionfinds", "hacoolinksvip",
  "HacooFranceLiens", "hacoolinks10chanel", "iammmchannel", "mariehacoo",
  "haccoyeplinks", "hacoolinks", "HacooLinksCarla1"
];

let productDatabase = [];
let isReadyToSearch = false;

async function performInitialScan() {
    console.log("🚀 Lancement du scan TOTAL (cela peut prendre plusieurs minutes)...");
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
            console.log(`📡 Extraction complète de : @${channel}`);
            try {
                await page.goto(`https://t.me/s/${channel}`, { waitUntil: "networkidle2", timeout: 60000 });
                
                // Attendre que le premier message soit chargé
                await page.waitForSelector(".tgme_widget_message", { timeout: 15000 }).catch(() => {});

                let previousHeight = 0;
                let scrollAttempts = 0;
                const maxScrolls = 50; // Limite de sécurité pour ne pas boucler à l'infini (environ 1000-2000 messages)

                // BOUCLE DE SCROLL INFINI VERS LE HAUT
                while (scrollAttempts < maxScrolls) {
                    const currentHeight = await page.evaluate(() => {
                        window.scrollTo(0, -100000); // Scroll violent vers le haut
                        return document.body.scrollHeight;
                    });

                    // On attend que Telegram charge les nouveaux messages (important !)
                    await new Promise(r => setTimeout(r, 2500)); 

                    // Si la hauteur n'a pas changé, c'est qu'on a atteint le tout début du canal
                    if (currentHeight === previousHeight) break;
                    
                    previousHeight = currentHeight;
                    scrollAttempts++;
                    if(scrollAttempts % 5 === 0) console.log(`   > Scroll ${scrollAttempts}/${maxScrolls} sur @${channel}...`);
                }

                // EXTRACTION DES DONNÉES
                const found = await page.evaluate(() => {
                    const messages = document.querySelectorAll(".tgme_widget_message");
                    const data = [];
                    
                    messages.forEach(msg => {
                        const text = msg.innerText || "";
                        // On cherche n'importe quel lien qui ressemble à de l'affilié ou du Hacoo
                        const links = Array.from(msg.querySelectorAll('a[href]'));
                        const productLink = links.find(a => 
                            /hacoo|onlyaff|c\.link|s\.click|t\.ly/.test(a.href) && 
                            !a.href.includes('t.me/s/')
                        );

                        const imgEl = msg.querySelector(".tgme_widget_message_photo_wrap");
                        let imgUrl = null;
                        if (imgEl) {
                            const style = imgEl.getAttribute("style");
                            const match = style ? style.match(/url\(['"]?([^'"]+)['"]?\)/) : null;
                            imgUrl = match ? match[1] : null;
                        }

                        if (productLink) {
                            // On nettoie le titre (souvent la 1ère ligne)
                            const title = text.split('\n')[0].trim().substring(0, 80) || "Produit Hacoo";
                            data.push({
                                title: title,
                                fullText: text.toLowerCase(),
                                link: productLink.href,
                                image: imgUrl
                            });
                        }
                    });
                    return data;
                });

                productDatabase.push(...found);
                console.log(`✅ @${channel} terminé : ${found.length} liens trouvés.`);

            } catch (err) {
                console.log(`❌ Erreur sur @${channel}: ${err.message}`);
            }
        }

        // --- NETTOYAGE FINAL ---
        // 1. Supprimer les doublons exacts sur l'URL
        const uniqueItems = Array.from(new Map(productDatabase.map(item => [item.link, item])).values());
        
        // 2. Filtrer les résultats sans titre cohérent (optionnel)
        productDatabase = uniqueItems.filter(item => item.link.startsWith('http'));

        isReadyToSearch = true;
        const total = productDatabase.length;
        console.log(`\n💎 SCAN TOTAL TERMINÉ !`);
        console.log(`📦 Nombre de produits en mémoire : ${total}`);

        const logChannel = client.channels.cache.get("1346455532481072398");
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🚀 Base de données mise à jour")
                .setDescription(`Le scan intensif est terminé.\n\n**Total d'articles :** \`${total}\`\n**Statut :** Prêt à l'emploi ✅`)
                .setColor("#5865F2")
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }

    } catch (e) {
        console.error("Erreur critique pendant le scan:", e);
    } finally {
        if (browser) await browser.close();
    }
}

// --- COMMANDE DE RECHERCHE ---
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "search") {
        if (!isReadyToSearch) {
            return interaction.reply({ content: "⏳ Le bot est en train de scanner des milliers de liens. Réessaie dans quelques minutes.", ephemeral: true });
        }

        const query = interaction.options.getString("query").toLowerCase();
        const keywords = query.split(" ");
        
        // Recherche avancée : tous les mots doivent être présents
        const results = productDatabase.filter(p => 
            keywords.every(word => p.fullText.includes(word))
        ).slice(0, 10); // Discord limite à 10 embeds

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

        await interaction.reply({ content: `🔍 **${results.length} meilleurs résultats pour :** _${query}_`, embeds: embeds });
    }
});

client.once("ready", async () => {
    const cmd = [
        new SlashCommandBuilder()
            .setName("search")
            .setDescription("Recherche un produit dans la base de données")
            .addStringOption(o => o.setName("query").setDescription("Ex: Ralph Lauren, TN, Sac...").setRequired(true))
    ];
    await client.application.commands.set(cmd);
    console.log(`Bot connecté : ${client.user.tag}`);
    
    // On lance le scan au démarrage
    performInitialScan();
});

client.login(process.env.DISCORD_TOKEN);
