//                  //
// WHITELIST SYSTEM //
//                  //
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const LOCK_FILE = path.join(__dirname, ".bot.lock");

const STAFF_ROLE = "1507806489891442858";
const VOUCH_ROLE = "1507718529158352997";
const APPLICATION_CHANNEL_ID = "1516380911862677604";
const REQUEST_CHANNEL_ID = "1507717895147487242";
const PANEL_MESSAGE_ID_META_KEY = "panel_message_id";

const {
    Client, GatewayIntentBits,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, Events
} = require("discord.js");
const mysql = require("mysql2/promise");

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
    console.error("Missing DISCORD_TOKEN in .env");
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let db;
let dbReady = false;

process.on("unhandledRejection", err => console.error(err));
client.on("error", err => console.error(err));

function acquireSingleInstanceLock() {
    if (fs.existsSync(LOCK_FILE)) {
        const existingPid = Number.parseInt(fs.readFileSync(LOCK_FILE, "utf8"), 10);
        if (existingPid && existingPid !== process.pid) {
            try {
                process.kill(existingPid, 0);
                console.error(`Another whitelist bot is already running (PID ${existingPid}). Stop it before starting again.`);
                process.exit(1);
            } catch {
                // stale lock file
            }
        }
    }

    fs.writeFileSync(LOCK_FILE, String(process.pid));
    const releaseLock = () => {
        try {
            if (fs.existsSync(LOCK_FILE) && fs.readFileSync(LOCK_FILE, "utf8") === String(process.pid)) {
                fs.unlinkSync(LOCK_FILE);
            }
        } catch {}
    };
    process.on("exit", releaseLock);
    process.on("SIGINT", () => {
        releaseLock();
        process.exit(0);
    });
}

function printStartupWarnings() {
    console.log("Whitelist bot starting...");
    console.warn(
        "IMPORTANT: If buttons show 'No handler available', txAdmin is likely using the SAME bot token.\n" +
        "Fix: txAdmin panel -> Settings -> Discord Bot -> use a DIFFERENT bot token, or disable the txAdmin Discord bot.\n" +
        "Your whitelist bot and txAdmin cannot share one Discord token."
    );
}

function getDiscordAge(user) {
    const createdAt = user.createdAt ?? new Date(user.createdTimestamp);
    return createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getVouchList(vouchers) {
    if (!vouchers || vouchers.length === 0) return "No vouches yet.";
    return vouchers.map(id => `<@${id}>`).join("\n");
}

function getApplicantId(embed) {
    const footer = embed.data.footer?.text ?? "";
    const match = footer.match(/User ID:\s*(\d+)/);
    return match?.[1] ?? null;
}

async function nextRequestNo() {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query("UPDATE meta SET value = value + 1 WHERE name = 'request_no'");
        const [rows] = await conn.query("SELECT value FROM meta WHERE name = 'request_no' LIMIT 1");
        await conn.commit();
        return rows[0]?.value ?? 0;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function getVouchers(applicantId) {
    const [rows] = await db.query(
        "SELECT voucher_id FROM member_vouches WHERE applicant_id = ? ORDER BY created_at ASC",
        [applicantId]
    );
    return rows.map(row => String(row.voucher_id));
}

async function addVouch(applicantId, voucherId) {
    await db.query(
        "INSERT IGNORE INTO member_vouches (applicant_id, voucher_id) VALUES (?, ?)",
        [applicantId, voucherId]
    );
}

function buildWhitelistModal() {
    const modal = new ModalBuilder()
        .setCustomId("whitelist_modal")
        .setTitle("Whitelist Application");

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("whitelist_name")
                .setLabel("Your Name")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Enter your name")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("whitelist_age")
                .setLabel("Your Age")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Enter your age")
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId("whitelist_steam")
                .setLabel("Steam Profile Link")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("https://steamcommunity.com/id/yourprofile")
                .setRequired(true)
        )
    );

    return modal;
}

function ensureDbReady(interaction) {
    if (dbReady && db) return true;
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: "The bot is still starting up. Please try again in a few seconds.", flags: 64 });
    }
    return false;
}

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isButton() && interaction.customId === "apply_whitelist") {
            return interaction.showModal(buildWhitelistModal());
        }

        if (!ensureDbReady(interaction)) return;

        if (interaction.isModalSubmit() && interaction.customId === "whitelist_modal") {
            if (!interaction.inGuild()) {
                return interaction.reply({ content: "This application must be submitted from the server.", flags: 64 });
            }

            if (interaction.member?.roles?.cache?.has(VOUCH_ROLE)) {
                return interaction.reply({ content: "You are already approved.", flags: 64 });
            }

            const name = interaction.fields.getTextInputValue("whitelist_name");
            const age = interaction.fields.getTextInputValue("whitelist_age");
            const steam = interaction.fields.getTextInputValue("whitelist_steam");
            const user = interaction.user;

            const [existingRows] = await db.query("SELECT status FROM vouches WHERE id = ? LIMIT 1", [user.id]);
            if (existingRows?.[0]?.status === "Pending") {
                return interaction.reply({
                    content: "You already have a pending whitelist request. Please wait for staff to review it.",
                    flags: 64
                });
            }

            await interaction.deferReply({ flags: 64 });

            const requestNo = await nextRequestNo();

            await db.query("DELETE FROM member_vouches WHERE applicant_id = ?", [user.id]);
            await db.query(`
                INSERT INTO vouches (id, discord_name, request_no) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE discord_name = ?, request_no = ?, status='Pending', denial_reason=NULL, reviewed_by=NULL, reviewed_at=NULL
            `, [user.id, name, requestNo, name, requestNo]);

            const submitTime = new Date().toLocaleString("en-US", {
                year: "numeric", month: "long", day: "numeric",
                hour: "numeric", minute: "2-digit", hour12: true
            });

            const embed = new EmbedBuilder()
                .setTitle(`Whitelist Request #${requestNo}`)
                .setColor("#2b2d31")
                .addFields(
                    { name: "Applicant", value: `<@${user.id}>`, inline: true },
                    { name: "Discord Age", value: getDiscordAge(user), inline: true },
                    { name: "Submitted At", value: submitTime, inline: true },
                    { name: "Name", value: name, inline: true },
                    { name: "Age", value: age, inline: true },
                    { name: "Steam Link", value: steam, inline: true },
                    { name: "Status", value: "Pending", inline: true },
                    { name: "Reviewed By", value: "N/A", inline: true },
                    { name: "Reviewed At", value: "N/A", inline: true },
                    { name: "✅ Vouches (0)", value: "No vouches yet.", inline: false },
                    { name: "Denial Reason", value: "N/A", inline: false }
                )
                .setFooter({ text: `MATRIX RP Whitelist • User ID: ${user.id}` });

            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("approve_vouch").setLabel("Approve").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("deny_vouch").setLabel("Deny").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("give_vouch").setLabel("Vouch").setStyle(ButtonStyle.Primary)
            );

            const requestChannel = await client.channels.fetch(REQUEST_CHANNEL_ID);
            if (!requestChannel?.isTextBased?.()) {
                return interaction.editReply({ content: "I couldn't find the whitelist request channel." });
            }

            await requestChannel.send({ embeds: [embed], components: [buttonRow] });
            return interaction.editReply({
                content: `✅ Your whitelist application has been submitted in <#${REQUEST_CHANNEL_ID}>`
            });
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith("deny_modal_")) {
            if (!interaction.inGuild() || !interaction.member.roles.cache.has(STAFF_ROLE)) {
                return interaction.reply({ content: "Staff only.", flags: 64 });
            }

            await interaction.deferUpdate();

            const applicantId = interaction.customId.slice("deny_modal_".length);
            const reason = interaction.fields.getTextInputValue("deny_reason");
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);

            embed.spliceFields(6, 3,
                { name: "Status", value: "Denied", inline: true },
                { name: "Reviewed By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Reviewed At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            );
            embed.spliceFields(10, 1, { name: "Denial Reason", value: reason, inline: false });
            embed.setColor("Red");

            await db.query(
                "UPDATE vouches SET status='Denied', reviewed_by=?, reviewed_at=NOW(), denial_reason=? WHERE id=?",
                [interaction.user.id, reason, applicantId]
            );

            return interaction.editReply({ embeds: [embed], components: [] });
        }

        if (interaction.isButton() && ["give_vouch", "approve_vouch", "deny_vouch"].includes(interaction.customId)) {
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            const applicantId = getApplicantId(embed);

            if (!applicantId) {
                return interaction.reply({ content: "Could not identify the applicant for this request.", flags: 64 });
            }

            if (interaction.customId === "give_vouch") {
                if (!interaction.inGuild()) {
                    return interaction.reply({ content: "This can only be used in a server.", flags: 64 });
                }

                if (interaction.user.id === applicantId) {
                    return interaction.reply({ content: "You can't vouch for yourself.", flags: 64 });
                }

                if (!interaction.member.roles.cache.has(VOUCH_ROLE)) {
                    return interaction.reply({ content: "Only whitelisted members can vouch.", flags: 64 });
                }

                const vouchers = await getVouchers(applicantId);
                if (vouchers.includes(interaction.user.id)) {
                    return interaction.reply({ content: "You already vouched.", flags: 64 });
                }

                await addVouch(applicantId, interaction.user.id);
                vouchers.push(interaction.user.id);

                embed.spliceFields(9, 1, {
                    name: `✅ Vouches (${vouchers.length})`,
                    value: getVouchList(vouchers),
                    inline: false
                });

                return interaction.update({ embeds: [embed] });
            }

            if (interaction.customId === "approve_vouch") {
                if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
                    return interaction.reply({ content: "Staff only.", flags: 64 });
                }

                await interaction.deferUpdate();

                try {
                    const member = await interaction.guild.members.fetch(applicantId);
                    await member.roles.add(VOUCH_ROLE);
                } catch (roleErr) {
                    console.error("Role assign failed:", roleErr);
                    return interaction.followUp({
                        content: "Could not assign the whitelist role. Move the bot role above the whitelist role in Server Settings → Roles, and ensure the bot has **Manage Roles**.",
                        flags: 64
                    });
                }

                embed.spliceFields(6, 3,
                    { name: "Status", value: "Approved", inline: true },
                    { name: "Reviewed By", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "Reviewed At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                );
                embed.spliceFields(10, 1, { name: "Denial Reason", value: "N/A", inline: false });
                embed.setColor("Green");

                await db.query(
                    "UPDATE vouches SET status='Approved', reviewed_by=?, reviewed_at=NOW(), denial_reason=NULL WHERE id=?",
                    [interaction.user.id, applicantId]
                );

                return interaction.editReply({ embeds: [embed], components: [] });
            }

            if (interaction.customId === "deny_vouch") {
                if (!interaction.member.roles.cache.has(STAFF_ROLE)) {
                    return interaction.reply({ content: "Staff only.", flags: 64 });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`deny_modal_${applicantId}`)
                    .setTitle("Denial Reason");

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId("deny_reason")
                            .setLabel("Reason")
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );

                return interaction.showModal(modal);
            }
        }
    } catch (err) {
        console.error("Interaction error:", err);
        if (!interaction.isRepliable()) return;

        const message = err.code === 10062
            ? "That button expired. Please click **Apply for Whitelist** again."
            : "Something went wrong. Please try again.";

        if (interaction.deferred) {
            await interaction.editReply({ content: message }).catch(() => {});
        } else if (!interaction.replied) {
            await interaction.reply({ content: message, flags: 64 }).catch(() => {});
        }
    }
});

async function main() {
    acquireSingleInstanceLock();
    printStartupWarnings();

db = await mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0
});

    await db.query(`
        CREATE TABLE IF NOT EXISTS vouches (
            id BIGINT PRIMARY KEY,
            discord_name VARCHAR(100),
            request_no BIGINT DEFAULT NULL,
            status ENUM('Pending','Approved','Denied') DEFAULT 'Pending',
            reviewed_by BIGINT DEFAULT NULL,
            reviewed_at DATETIME DEFAULT NULL,
            denial_reason TEXT DEFAULT NULL,
            submit_time DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS member_vouches (
            applicant_id BIGINT NOT NULL,
            voucher_id BIGINT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (applicant_id, voucher_id)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS meta (
            name VARCHAR(64) PRIMARY KEY,
            value BIGINT NOT NULL
        )
    `);

    await db.query("INSERT INTO meta (name, value) VALUES ('request_no', 0) ON DUPLICATE KEY UPDATE value=value");
    await db.query("INSERT INTO meta (name, value) VALUES (?, 0) ON DUPLICATE KEY UPDATE value=value", [PANEL_MESSAGE_ID_META_KEY]);

    dbReady = true;
    console.log("Database ready");

    client.once(Events.ClientReady, async () => {
        console.log(`Logged in as ${client.user.tag}`);
        console.log(`Interaction listeners: ${client.listenerCount(Events.InteractionCreate)} (should be 1)`);

        try {
            const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID);
            if (!channel?.isTextBased?.()) return;

            const panelEmbed = new EmbedBuilder()
                .setTitle("MATRIX RP • Whitelist Application")
                .setColor("#25c520")
                .setDescription(
                    "Welcome to **MATRIX RP**!\n\n" +
                    "We're excited to have you here. Before entering the city, all players must complete the whitelist process to help us maintain a high-quality roleplay environment.\n\n" +
                    "Please read the information below carefully before submitting your application."
                )
                .addFields(
                    {
                        name: "📋 Requirements",
                        value:
                            "• Applicants must be **17 years old or older**.\n" +
                            "• Be respectful, mature, and honest in your answers.\n" +
                            "• Low-effort or troll applications will be denied.\n" +
                            "• Having a vouch from an existing community member may help during review.",
                        inline: false
                    },
                    {
                        name: "🧭 How to Apply",
                        value:
                            "• Press the **Apply** button below.\n" +
                            "• Fill out all required information carefully.\n" +
                            "• Double-check your answers before submitting.\n" +
                            "• Once submitted, our staff team will review your application as soon as possible.",
                        inline: false
                    },
                    {
                        name: "⚠️ Important Information",
                        value:
                            "• Only **one active application** is allowed per player.\n" +
                            "• Providing false information may result in an instant denial.\n" +
                            "• Spamming applications or trolling staff may lead to blacklisting.\n" +
                            "• Staff decisions are final and should be respected.",
                        inline: false
                    },
                    {
                        name: "🌆 Ready to Join?",
                        value:
                            "Take your time and give us your best application. We’re looking for players who are serious about creating immersive and enjoyable roleplay experiences.\n\n" +
                            "Good luck, and we hope to see you in **MATRIX RP** soon!",
                        inline: false
                    }
                )
            .setFooter({ text: "MATRIX RP • Whitelist System" });

            const panelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("apply_whitelist")
                    .setLabel("Apply for Whitelist")
                    .setStyle(ButtonStyle.Primary)
            );

            const [metaRows] = await db.query("SELECT value FROM meta WHERE name = ? LIMIT 1", [PANEL_MESSAGE_ID_META_KEY]);
            const existingMessageId = metaRows?.[0]?.value ? String(metaRows[0].value) : null;

            if (existingMessageId && existingMessageId !== "0") {
                try {
                    const msg = await channel.messages.fetch(existingMessageId);
                    await msg.edit({ embeds: [panelEmbed], components: [panelRow] });
                    return;
                } catch {}
            }

            try {
                const recent = await channel.messages.fetch({ limit: 50 });
                const existingPanel = recent.find(m => {
                    if (m.author?.id !== client.user.id) return false;
                    const e = m.embeds?.[0];
                    const title = e?.title ?? e?.data?.title;
                    return title === "MATRIX RP Whitelist Application";
                });

                if (existingPanel) {
                    await existingPanel.edit({ embeds: [panelEmbed], components: [panelRow] });
                    await db.query("UPDATE meta SET value = ? WHERE name = ?", [existingPanel.id, PANEL_MESSAGE_ID_META_KEY]);
                    return;
                }
            } catch {}

            const msg = await channel.send({ embeds: [panelEmbed], components: [panelRow] });
            await db.query("UPDATE meta SET value = ? WHERE name = ?", [msg.id, PANEL_MESSAGE_ID_META_KEY]);
        } catch (err) {
            console.error(err);
        }
    });

    await client.login(TOKEN);
}

main().catch(console.error);
