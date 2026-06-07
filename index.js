const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const config = require('./config.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ==========================
// PARSE REQUEST
// ==========================
function parseRequest(message) {
  const content = message.content;

  const nameMatch =
    content.match(/Name:\s*([^\n]+)/i);

  const roleMatch =
    content.match(/Role:\s*<@&(\d+)>/i);

  const unroleMatch =
    content.match(/Unrole:\s*<@&(\d+)>/i);

  const approvedByMatch =
    content.match(
      /Approved by:\s*<@!?(\d+)>/i
    );

  if (
    !nameMatch ||
    !approvedByMatch
  ) return null;

  // UNROLE
  if (unroleMatch) {
    return {
      type: 'unrole',
      name: nameMatch[1].trim(),
      roleId: unroleMatch[1],
      approvedBy:
        approvedByMatch[1]
    };
  }

  // ROLE
  if (roleMatch) {
    return {
      type: 'role',
      name: nameMatch[1].trim(),
      roleId: roleMatch[1],
      approvedBy:
        approvedByMatch[1]
    };
  }

  return null;
}

// ==========================
// ROLE REQUEST
// ==========================
async function handleRoleRequest(
  message,
  data
) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Role Request')
    .setColor('#ffaa00')
    .setThumbnail(config.thumbnail)
    .addFields(
      {
        name: 'Requester',
        value: `${message.author}`,
        inline: true
      },
      {
        name: 'IGN',
        value: data.name,
        inline: true
      },
      {
        name: 'Role',
        value: `<@&${data.roleId}>`,
        inline: true
      },
      {
        name: 'Approved by',
        value: '⏳ Waiting for Non-Admin',
        inline: false
      },
      {
        name: 'Approval Status',
        value:
          '⏳ Waiting for Admin Approval',
        inline: false
      }
    )
    .setFooter({
      text: `Requested by: ${message.author.username}`
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    // NON ADMIN APPROVE
    new ButtonBuilder()
      .setCustomId(
        `nonadmin_role_${message.author.id}_${data.roleId}_${data.approvedBy}`
      )
      .setLabel('✅ Non-Admin Approve')
      .setStyle(ButtonStyle.Primary),

    // ADMIN APPROVE
    new ButtonBuilder()
      .setCustomId(
        `admin_role_${message.author.id}_${data.roleId}`
      )
      .setLabel('👑 Admin Approve')
      .setStyle(ButtonStyle.Success)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });

  await message.delete().catch(() => {});
}

// ==========================
// UNROLE REQUEST
// ==========================
async function handleUnroleRequest(
  message,
  data
) {
  const embed = new EmbedBuilder()
    .setTitle('❌ Unrole Request')
    .setColor('#ffaa00')
    .setThumbnail(config.thumbnail)
    .addFields(
      {
        name: 'Requester',
        value: `${message.author}`,
        inline: true
      },
      {
        name: 'IGN',
        value: data.name,
        inline: true
      },
      {
        name: 'Unrole',
        value: `<@&${data.roleId}>`,
        inline: true
      },
      {
        name: 'Approved by',
        value: '⏳ Waiting for Non-Admin',
        inline: false
      },
      {
        name: 'Approval Status',
        value:
          '⏳ Waiting for Admin Approval',
        inline: false
      }
    )
    .setFooter({
      text: `Requested by: ${message.author.username}`
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    // NON ADMIN APPROVE
    new ButtonBuilder()
      .setCustomId(
        `nonadmin_unrole_${message.author.id}_${data.roleId}_${data.approvedBy}`
      )
      .setLabel('✅ Non-Admin Approve')
      .setStyle(ButtonStyle.Primary),

    // ADMIN APPROVE
    new ButtonBuilder()
      .setCustomId(
        `admin_unrole_${message.author.id}_${data.roleId}`
      )
      .setLabel('👑 Admin Approve')
      .setStyle(ButtonStyle.Success)
  );

  await message.channel.send({
    embeds: [embed],
    components: [row]
  });

  await message.delete().catch(() => {});
}

// ==========================
// MESSAGE CREATE
// ==========================
client.on(
  Events.MessageCreate,
  async (message) => {
    if (
      message.author.bot ||
      !message.guild
    ) return;

    const parsed =
      parseRequest(message);

    if (!parsed) return;

    if (parsed.type === 'role') {
      return handleRoleRequest(
        message,
        parsed
      );
    }

    if (parsed.type === 'unrole') {
      return handleUnroleRequest(
        message,
        parsed
      );
    }
  }
);

// ==========================
// BUTTON HANDLER
// ==========================
client.on(
  Events.InteractionCreate,
  async (interaction) => {
    if (!interaction.isButton()) return;

    const parts =
      interaction.customId.split('_');

    const action = parts[0];
    const type = parts[1];

    // ==========================
    // NON ADMIN APPROVE
    // ==========================
    if (action === 'nonadmin') {
      const userId = parts[2];
      const roleId = parts[3];
      const approverId = parts[4];

      // ONLY MENTIONED USER
      if (
        interaction.user.id !==
        approverId
      ) {
        return interaction.reply({
          content:
            '❌ Only mentioned non-admin can approve.',
          ephemeral: true
        });
      }

      const embed =
        interaction.message.embeds[0];

      // ALREADY APPROVED
      if (
        embed.fields[3].value !==
        '⏳ Waiting for Non-Admin'
      ) {
        return interaction.reply({
          content:
            '❌ Non-admin already approved.',
          ephemeral: true
        });
      }

      const updatedEmbed =
        EmbedBuilder.from(embed)
          .spliceFields(3, 1, {
            name: 'Approved by',
            value: `${interaction.user}`,
            inline: false
          });

      return interaction.update({
        embeds: [updatedEmbed]
      });
    }

    // ==========================
    // ADMIN APPROVE
    // ==========================
    if (action === 'admin') {
      const userId = parts[2];
      const roleId = parts[3];

      const member =
        await interaction.guild.members.fetch(
          interaction.user.id
        );

      // ADMIN CHECK
      if (
        !member.roles.cache.has(
          config.adminRoleId
        )
      ) {
        return interaction.reply({
          content:
            '❌ Only admins can approve.',
          ephemeral: true
        });
      }

      const embed =
        interaction.message.embeds[0];

      // NEED NON ADMIN FIRST
      if (
        embed.fields[3].value ===
        '⏳ Waiting for Non-Admin'
      ) {
        return interaction.reply({
          content:
            '❌ Non-admin must approve first.',
          ephemeral: true
        });
      }

      // ALREADY APPROVED
      if (
        embed.fields[4].value.includes(
          'Approved'
        )
      ) {
        return interaction.reply({
          content:
            '❌ Already approved.',
          ephemeral: true
        });
      }

      try {
        const target =
          await interaction.guild.members.fetch(
            userId
          );

        // ROLE
        if (type === 'role') {
          await target.roles.add(roleId);
        }

        // UNROLE
        if (type === 'unrole') {
          await target.roles.remove(roleId);
        }

        const updatedEmbed =
          EmbedBuilder.from(embed)
            .spliceFields(4, 1, {
              name: 'Approval Status',
              value: `✅ Approved by ${interaction.user}`,
              inline: false
            })
            .setColor(
              type === 'role'
                ? '#00ff00'
                : '#ff0000'
            );

        const row =
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('done')
              .setLabel('✅ Approved')
              .setDisabled(true)
              .setStyle(ButtonStyle.Success)
          );

        await interaction.update({
          embeds: [updatedEmbed],
          components: [row]
        });

      } catch (err) {
        console.error(err);

        interaction.reply({
          content:
            '❌ Missing Permissions.',
          ephemeral: true
        });
      }
    }
  }
);

client.login(process.env.TOKEN);
