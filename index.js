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

client.on(Events.MessageCreate, async (message) => {

    if (message.author.bot) return;

    // REQUIRED FORMAT:
    // Name:
    // Steam Link:
    // Vouched by:

    if (
        message.content.includes("Name:") &&
        message.content.includes("Steam Link:") &&
        message.content.includes("Vouched by:")
    ) {

        const lines = message.content.split('\n');

        const name =
            lines.find(x => x.startsWith("Name:"))
            ?.replace("Name:", "")
            .trim() || "N/A";

        const steam =
            lines.find(x => x.startsWith("Steam Link:"))
            ?.replace("Steam Link:", "")
            .trim() || "N/A";

        const vouched =
            lines.find(x => x.startsWith("Vouched by:"))
            ?.replace("Vouched by:", "")
            .trim() || "No vouch";

        // GET MENTIONED USER
        const mention = message.mentions.users.first();

        const row = new ActionRowBuilder().addComponents(

            // APPROVE VOUCH
            new ButtonBuilder()
                .setCustomId(`vouch_${mention?.id || "none"}_${message.author.id}`)
                .setLabel("Approve Vouch")
                .setStyle(ButtonStyle.Primary),

            // APPROVE WL
            new ButtonBuilder()
                .setCustomId(`approve_${message.author.id}`)
                .setLabel("Approve WL")
                .setStyle(ButtonStyle.Success),

            // DENY
            new ButtonBuilder()
                .setCustomId(`deny_${message.author.id}`)
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setColor("Yellow")
            .setTitle(`Whitelist Request #${Math.floor(Math.random() * 9999)}`)

            // RIGHT SIDE IMAGE
            .setThumbnail('https://media.discordapp.net/attachments/1508176750947991673/1508177857254265014/matrixroll.gif?ex=6a1a8655&is=6a1934d5&hm=de569ef397d3bb1402c4e69d4945b8bb722eb22260501eb953df844d05bbc514&=')

            .addFields(
                {
                    name: "Applicant",
                    value: `${message.author}`,
                    inline: true
                },
                {
                    name: "Submitted At",
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true
                },
                {
                    name: "Name",
                    value: name,
                    inline: true
                },
                {
                    name: "Steam Link",
                    value: steam,
                    inline: false
                },
                {
                    name: "Status",
                    value: "Pending",
                    inline: true
                },
                {
                    name: "Reviewed By",
                    value: "N/A",
                    inline: true
                },
                {
                    name: "Reviewed At",
                    value: "N/A",
                    inline: true
                },
                {
                    name: "☑️ Vouched By",
                    value: vouched,
                    inline: false
                }
            )
            .setFooter({
                text: `MATRIX RP Whitelist • User ID: ${message.author.id}`
            });

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        // DELETE ORIGINAL MESSAGE
        await message.delete().catch(() => {});
    }
});

client.on(Events.InteractionCreate, async (interaction) => {

    if (!interaction.isButton()) return;

    const embed = interaction.message.embeds[0];
    if (!embed) return;

    const fields = embed.fields;

    // =========================
    // VOUCH APPROVE
    // =========================
    if (interaction.customId.startsWith("vouch_")) {

        const parts = interaction.customId.split("_");
        const vouchUserId = parts[1];

        // ONLY VOUCHED USER
        if (interaction.user.id !== vouchUserId) {
            return interaction.reply({
                content: "❌ Only the vouched user can approve this.",
                ephemeral: true
            });
        }

        // CHANGE CHECK
        fields[7].name = "✅ Vouched By";

        const updatedEmbed = EmbedBuilder.from(embed)
            .setFields(fields);

        const oldRow = interaction.message.components[0];

        const newRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(oldRow.components[0]).setDisabled(true),
            ButtonBuilder.from(oldRow.components[1]),
            ButtonBuilder.from(oldRow.components[2])
        );

        await interaction.update({
            embeds: [updatedEmbed],
            components: [newRow]
        });
    }

    // =========================
    // WL APPROVE
    // =========================
    if (interaction.customId.startsWith("approve_")) {

        // ADMIN ROLE CHECK
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            return interaction.reply({
                content: "❌ Only admin role can approve whitelist.",
                ephemeral: true
            });
        }

        // CHECK VOUCH
        if (fields[7].name !== "✅ Vouched By") {
            return interaction.reply({
                content: "❌ The vouched user has not approved this yet.",
                ephemeral: true
            });
        }

        // GET USER ID
        const footer = embed.footer.text;
        const userId = footer.split("User ID: ")[1];

        // GET MEMBER
        const member = await interaction.guild.members.fetch(userId);

        // GET RP NAME
        const rpName = fields[2].value;

        // ROLE IDS
        const citizenRoleId = '1507718529158352997';
        const unverifiedRoleId = '1507798147303211222';

        // ADD ROLE
        await member.roles.add(citizenRoleId).catch(console.error);

        // REMOVE ROLE
        await member.roles.remove(unverifiedRoleId).catch(console.error);

        // CHANGE NICKNAME
        await member.setNickname(rpName).catch(console.error);

        // UPDATE EMBED
        fields[4].value = "Approved";
        fields[5].value = `${interaction.user}`; // reviewer
        fields[6].value = `<t:${Math.floor(Date.now() / 1000)}:F>`;

        const updatedEmbed = EmbedBuilder.from(embed)
            .setColor("Green")
            .setFields(fields);

        const oldRow = interaction.message.components[0];

        const newRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(oldRow.components[0]).setDisabled(true),
            ButtonBuilder.from(oldRow.components[1]).setDisabled(true),
            ButtonBuilder.from(oldRow.components[2]).setDisabled(true)
        );

        await interaction.update({
            embeds: [updatedEmbed],
            components: [newRow]
        });
    }

    // =========================
    // DENY
    // =========================
    if (interaction.customId.startsWith("deny_")) {

        // GET VOUCH USER ID
        const vouchButtonId =
            interaction.message.components[0].components[0].customId;

        const vouchUserId = vouchButtonId.split("_")[1];

        // ONLY VOUCHED USER
        if (interaction.user.id !== vouchUserId) {
            return interaction.reply({
                content: "❌ Only the vouched user can deny this whitelist.",
                ephemeral: true
            });
        }

        // UPDATE EMBED
        fields[4].value = "Denied";
        fields[5].value = `${interaction.user}`;
        fields[6].value = `<t:${Math.floor(Date.now() / 1000)}:F>`;

        // CHANGE CHECK TO X
        fields[7].name = "❌ Vouched By";

        const updatedEmbed = EmbedBuilder.from(embed)
            .setColor("Red")
            .setFields(fields);

        // DISABLE BUTTONS
        const oldRow = interaction.message.components[0];

        const newRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(oldRow.components[0]).setDisabled(true),
            ButtonBuilder.from(oldRow.components[1]).setDisabled(true),
            ButtonBuilder.from(oldRow.components[2]).setDisabled(true)
        );

        await interaction.update({
            embeds: [updatedEmbed],
            components: [newRow]
        });
    }

});

client.login(process.env.TOKEN);