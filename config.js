module.exports = {
  token: process.env.TOKEN,
  clientId: '1509082181073506395',

  /* =========================================================
     ROLES (PERMISSIONS)
  ========================================================= */

  roles: {
    // WHITELIST APPROVAL ONLY
    headAdmin: '1507806489891442858',

    // ROLE / UNROLE APPROVAL ONLY
    admin: '15078065393003438699',

    // OPTIONAL MODERATOR
    moderator: '1507806564310843403',
  },

  /* =========================================================
     REQUEST SETTINGS
  ========================================================= */

  requests: {
    roleRequestAdminRoleId: '1507806539300343869',
    unroleRequestChannelId: '1507961836752994416',
  },

  /* =========================================================
     VISUALS
  ========================================================= */

  images: {
    thumbnail:
      'https://media.discordapp.net/attachments/1508176750947991673/1508177857254265014/matrixroll.gif',
  },

  /* =========================================================
     SERVER ROLES
  ========================================================= */

  serverRoles: {
    citizen: '1507718529158352997',
    unverified: '1507798147303211222',
  }
};