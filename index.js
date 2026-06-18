const {
    Client,
    GatewayIntentBits,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');

const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let requestNumber = 1;

client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} is online!`);

    const channel = await client.channels.fetch(config.channels.application);

const embed = new EmbedBuilder()
    .setColor('#15ff00')
    .setTitle('MATRIX CITY Whitelist Application')
    .setDescription(`
Welcome to MATRIX CITY!

Glad you're here! 🎉 Before you can jump in and be part of the city, you'll need to complete our whitelist application. Don't worry—it's quick and simple if you follow the guide below.

🚦 **Before You Apply**
• Make sure you’re ready:
• You need to be at least 17 years old.
• Keep it real, respectful, and honest—we value authenticity.- Got friends already in? A vouch from a current member can help move things along faster.

🧭 **Application Steps**
• Getting started is easy:
• Hit the “Apply” button below.
• Fill out your information carefully and correctly.
• Send it in and hang tight while staff reviews your application.

⚠️ **Keep in Mind**
• Only one active application at a time—no duplicates.
• False info = instant rejection, no second chances.
• Once staff decides, that decision stands.

Take your time, put your best foot forward, and show us what you’ve got. We’re looking forward to seeing you join the world of MATRIX CITY! 🌟

**Whitelist System**
`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('apply_whitelist')
            .setLabel('Apply for Whitelist')
            .setStyle(ButtonStyle.Primary)
    );

    const messages = await channel.messages.fetch({ limit: 10 });
    const exists = messages.find(
        m =>
            m.author.id === client.user.id &&
            m.components.length > 0
    );

    if (!exists) {
        await channel.send({
            embeds: [embed],
            components: [row]
        });
    }
});

client.on(Events.InteractionCreate, async interaction => {

    // APPLY BUTTON
    if (
        interaction.isButton() &&
        interaction.customId === 'apply_whitelist'
    ) {
        const modal = new ModalBuilder()
            .setCustomId('whitelist_modal')
            .setTitle('Whitelist Application');

        const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const steamInput = new TextInputBuilder()
            .setCustomId('steam')
            .setLabel('Steam Link')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(steamInput)
        );

        return interaction.showModal(modal);
    }

    // MODAL SUBMIT
    if (
        interaction.isModalSubmit() &&
        interaction.customId === 'whitelist_modal'
    ) {
        const name =
            interaction.fields.getTextInputValue('name');

        const steam =
            interaction.fields.getTextInputValue('steam');

        const requestChannel =
            await client.channels.fetch(
                config.channels.request
            );

const reviewedAt =
`<t:${Math.floor(Date.now()/1000)}:F>\n<t:${Math.floor(Date.now()/1000)}:R>`;

const embed = new EmbedBuilder()
    .setColor('#15ff00')
    .setTitle(`Whitelist Request #${requestNumber}`)
    .setThumbnail(config.images.thumbnail)

    .addFields(
        {
            name: 'Applicant',
            value: `${interaction.user}`,
            inline: true
        },
        {
            name: 'Submitted At',
            value: submittedAt,
            inline: true
        },
        {
            name: 'Name',
            value: name,
            inline: true
        },

        {
            name: 'Steam Link',
            value: steam,
            inline: false
        },

        {
            name: 'Status',
            value: 'Pending',
            inline: true
        },
        {
            name: 'Reviewed By',
            value: 'N/A',
            inline: true
        },
        {
            name: 'Reviewed At',
            value: 'N/A',
            inline: true
        },

        {
            name: 'Vouched By',
            value: 'No vouches yet.',
            inline: false
        }
    )

    .setFooter({
        text: `MATRIX CITY Whitelist • User ID: ${interaction.user.id}`
    })
    .setTimestamp();

const buttons =
    new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('vouch')
            .setLabel('Vouch')
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId('deny')
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger)
    );

        await requestChannel.send({
            embeds: [embed],
            components: [buttons]
        });

        requestNumber++;

        return interaction.reply({
            content:
                '✅ Your whitelist application has been submitted.',
            ephemeral: true
        });
    }

// APPROVE
if (
    interaction.isButton() &&
    interaction.customId === 'approve'
) {
    if (
        !interaction.member.roles.cache.has(
            config.roles.headAdmin
        )
    ) {
        return interaction.reply({
            content: '❌ No permission.',
            ephemeral: true
        });
    }

    const oldEmbed = interaction.message.embeds[0];

const reviewedAt =
`<t:${Math.floor(Date.now()/1000)}:F>\n<t:${Math.floor(Date.now()/1000)}:R>`;

    const vouchedField =
        oldEmbed.fields.find(
            f =>
                f.name === '✅ Vouched By' ||
                f.name === 'Vouched By'
        ) || {
            name: 'Vouched By',
            value: 'No vouches yet.',
            inline: false
        };

    const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle(oldEmbed.title)
        .setThumbnail(config.images.thumbnail)
        .setFields(
            {
                name: 'Applicant',
                value: oldEmbed.fields[0].value,
                inline: true
            },
            {
                name: 'Submitted At',
                value: oldEmbed.fields[1].value,
                inline: true
            },
            {
                name: 'Name',
                value: oldEmbed.fields[2].value,
                inline: true
            },
            {
                name: 'Steam Link',
                value: oldEmbed.fields[3].value,
                inline: false
            },
            {
                name: 'Status',
                value: 'Approved',
                inline: true
            },
            {
                name: 'Reviewed By',
                value: `${interaction.user}`,
                inline: true
            },
            {
                name: 'Reviewed At',
                value: reviewedAt,
                inline: true
            },
            vouchedField
        )
        .setFooter(oldEmbed.footer)
        .setTimestamp();

    await interaction.update({
        embeds: [embed],
        components: []
    });
}

// VOUCH
if (
    interaction.isButton() &&
    interaction.customId === 'vouch'
) {
    const oldEmbed = interaction.message.embeds[0];

    const vouchedField = oldEmbed.fields.find(
        f =>
            f.name === '✅ Vouched By'
    );

    if (vouchedField) {
        return interaction.reply({
            content: '❌ Already vouched.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor(oldEmbed.color || '#15ff00')
        .setTitle(oldEmbed.title)
        .setThumbnail(config.images.thumbnail)
        .setFields(
            oldEmbed.fields.map(field => {
                if (field.name === 'Vouched By') {
                    return {
                        name: '✅ Vouched By',
                        value: `${interaction.user}`,
                        inline: false
                    };
                }

                return field;
            })
        )
        .setFooter(oldEmbed.footer)
        .setTimestamp();

    const adminButtons =
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('approve')
                .setLabel('Approve')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('deny')
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger)
        );

    return interaction.update({
        embeds: [embed],
        components: [adminButtons]
    });
}

{
    const oldEmbed = interaction.message.embeds[0];

const reviewedAt =
`<t:${Math.floor(Date.now()/1000)}:F>\n<t:${Math.floor(Date.now()/1000)}:R>`;

const vouchedField =
    oldEmbed.fields.find(
        f =>
            f.name === '✅ Vouched By' ||
            f.name === 'Vouched By'
    ) || {
        name: 'Vouched By',
        value: 'No vouches yet.',
        inline: false
    };

const embed = new EmbedBuilder()
    .setColor('Green')
    .setTitle(oldEmbed.title)
    .setThumbnail(config.images.thumbnail)
    .setFields(
        {
            name: 'Applicant',
            value: oldEmbed.fields[0].value,
            inline: true
        },
        {
            name: 'Submitted At',
            value: oldEmbed.fields[1].value,
            inline: true
        },
        {
            name: 'Name',
            value: oldEmbed.fields[2].value,
            inline: true
        },
        {
            name: 'Steam Link',
            value: oldEmbed.fields[3].value,
            inline: false
        },
        {
            name: 'Status',
            value: 'Approved',
            inline: true
        },
        {
            name: 'Reviewed By',
            value: `${interaction.user}`,
            inline: true
        },
        {
            name: 'Reviewed At',
            value: reviewedAt,
            inline: true
        },
        vouchedField
    )
    .setFooter(oldEmbed.footer)
    .setTimestamp();

await interaction.update({
    embeds: [embed],
    components: []
});
}

    // DENY
    if (
        interaction.isButton() &&
        interaction.customId === 'deny'
    ) {
        if (
            !interaction.member.roles.cache.has(
                config.roles.headAdmin
            )
        ) {
            return interaction.reply({
                content: '❌ No permission.',
                ephemeral: true
            });
        }

        const oldEmbed =
            interaction.message.embeds[0];

        const embed = EmbedBuilder.from(oldEmbed)
            .setColor('Red')
            .spliceFields(3, 1, {
                name: 'Status',
                value: 'Denied',
                inline: true
            })
            .addFields({
                name: 'Reviewed By',
                value: `${interaction.user}`,
                inline: true
            });

        await interaction.update({
            embeds: [embed],
            components: []
        });
    }
});

client.login(process.env.TOKEN);