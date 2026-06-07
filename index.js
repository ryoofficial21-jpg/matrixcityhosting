const {
    Client,
    GatewayIntentBits,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`${client.user.tag} is online!`);
});

/* =========================================================
   MESSAGE CREATE
========================================================= */

client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content;

    /* ================= WHITELIST ================= */

    if (
        content.includes("Name:") &&
        content.includes("Steam Link:") &&
        content.includes("Vouched by:")
    ) {
        const lines = content.split('\n');

        const name =
            lines.find(x => x.startsWith("Name:"))?.replace("Name:", "").trim() || "N/A";

        const steam =
            lines.find(x => x.startsWith("Steam Link:"))?.replace("Steam Link:", "").trim() || "N/A";

        const vouched =
            lines.find(x => x.startsWith("Vouched by:"))?.replace("Vouched by:", "").trim() || "No vouch";

        const mention = message.mentions.users.first();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`vouch_${mention?.id || "none"}_${message.author.id}`)
                .setLabel("Approve Vouch")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`approve_${message.author.id}`)
                .setLabel("Approve WL")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`deny_${message.author.id}`)
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setColor("Yellow")
            .setTitle(`Whitelist Request #${Math.floor(Math.random() * 9999)}`)
            .setThumbnail(config.images.thumbnail)
        
            .addFields(
                { name: "Applicant", value: `${message.author}`, inline: true },
                { name: "Submitted At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: "Name", value: name, inline: true },
                { name: "Steam Link", value: steam, inline: false },
                { name: "Status", value: "Pending", inline: true },
                { name: "Reviewed By", value: "N/A", inline: true },
                { name: "Reviewed At", value: "N/A", inline: true },
                { name: "☑️ Vouched By", value: vouched, inline: false }
            )
            .setFooter({ text: `User ID: ${message.author.id}` });

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
    }

    /* ================= ROLE / UNROLE ================= */

    const roleMatch = content.match(/Role:\s*<@&(\d+)>/i);
    const unroleMatch = content.match(/Unrole:\s*<@&(\d+)>/i);
    const nameMatch = content.match(/Name:\s*([^\n]+)/i);
    const approvedByMatch = content.match(/Approved by:\s*<@!?(\d+)>/i);

    if (!nameMatch || !approvedByMatch) return;

    let type = null;
    let roleId = null;

    if (roleMatch) {
        type = "role";
        roleId = roleMatch[1];
    } else if (unroleMatch) {
        type = "unrole";
        roleId = unroleMatch[1];
    } else {
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(type === "role" ? "✅ Role Request" : "❌ Unrole Request")
        .setColor("#ffaa00")
        .setThumbnail(config.images.thumbnail)
        .addFields(
            { name: "Requester", value: `${message.author}`, inline: true },
            { name: "IGN", value: nameMatch[1].trim(), inline: true },
            { name: type === "role" ? "Role" : "Unrole", value: `<@&${roleId}>`, inline: true },
            { name: "Approved by", value: "⏳ Waiting for Non-Admin", inline: false },
            { name: "Approval Status", value: "⏳ Waiting for Admin Approval", inline: false }
        )
        .setFooter({ text: `User ID: ${message.author.id}` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`nonadmin_${type}_${message.author.id}_${roleId}_${approvedByMatch[1]}`)
            .setLabel("Non-Admin Approve")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`admin_${type}_${message.author.id}_${roleId}`)
            .setLabel("Admin Approve")
            .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
});

/* =========================================================
   INTERACTION CREATE
========================================================= */

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const embed = interaction.message.embeds[0];
    if (!embed) return;

    const fields = [...embed.fields];
    const parts = interaction.customId.split("_");

    const action = parts[0];

    /* ================= VOUCH ================= */

    if (action === "vouch") {
        const vouchUserId = parts[1];

        if (interaction.user.id !== vouchUserId) {
            return interaction.reply({
                content: "❌ Only vouched user can approve.",
                ephemeral: true
            });
        }

        const newFields = [...fields];

        newFields[7] = {
            name: "✅ Vouched By",
            value: newFields[7]?.value || "No vouch",
            inline: false
        };

        return interaction.update({
            embeds: [EmbedBuilder.from(embed).setFields(newFields)]
        });
    }

    /* ================= WHITELIST APPROVE ================= */

    if (action === "approve") {
        const userId = parts[1];

        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!member.roles.cache.has(config.roles.headAdmin)) {
            return interaction.reply({
                content: "❌ Head Admin only.",
                ephemeral: true
            });
        }

        const target = await interaction.guild.members.fetch(userId);

        await target.roles.add(config.serverRoles.citizen).catch(() => {});
        await target.roles.remove(config.serverRoles.unverified).catch(() => {});
        await target.setNickname(fields[2].value).catch(() => {});

        const updated = EmbedBuilder.from(embed)
            .setColor("Green")
            .setFields(
                ...fields.slice(0, 4),
                { name: "Status", value: "Approved", inline: true },
                { name: "Reviewed By", value: `${interaction.user}`, inline: true },
                { name: "Reviewed At", value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
                fields[7]
            );

        return interaction.update({
            embeds: [updated],
            components: []
        });
    }

    /* ================= DENY ================= */

    if (action === "deny") {
        const updated = EmbedBuilder.from(embed)
            .setColor("Red")
            .setFields(
                ...fields.slice(0, 4),
                { name: "Status", value: "Denied", inline: true },
                { name: "Reviewed By", value: `${interaction.user}`, inline: true },
                { name: "Reviewed At", value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true },
                { name: "❌ Vouched By", value: fields[7]?.value || "No vouch", inline: false }
            );

        return interaction.update({ embeds: [updated] });
    }

    /* ================= ROLE / UNROLE ================= */

    if (action === "nonadmin" || action === "admin") {
        const roleType = parts[1];
        const userId = parts[2];
        const roleId = parts[3];

        const member = await interaction.guild.members.fetch(userId);

        /* NON ADMIN */
        if (action === "nonadmin") {
            const approverId = parts[4];

            if (interaction.user.id !== approverId) {
                return interaction.reply({
                    content: "❌ Only assigned non-admin can approve.",
                    ephemeral: true
                });
            }

            const updatedEmbed = EmbedBuilder.from(embed);

            const newFields = [...fields];
            newFields[3] = {
                name: "Approved by",
                value: `${interaction.user}`,
                inline: false
            };

            updatedEmbed.setFields(newFields);

            return interaction.update({ embeds: [updatedEmbed] });
        }

        /* ADMIN */
        if (action === "admin") {
            if (!interaction.member.roles.cache.has(config.roles.admin)) {
                return interaction.reply({
                    content: "❌ Admin only.",
                    ephemeral: true
                });
            }

            if (roleType === "role") await member.roles.add(roleId);
            if (roleType === "unrole") await member.roles.remove(roleId);

            return interaction.update({
                embeds: [EmbedBuilder.from(embed).setColor("Green")],
                components: []
            });
        }
    }
});

client.login(process.env.TOKEN);