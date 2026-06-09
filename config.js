module.exports = {
  token: process.env.TOKEN,
  clientId: '1513530505734389862',

  /* =========================================================
     ROLES (PERMISSIONS)
  ========================================================= */

  roles: {
    // WHITELIST APPROVAL ONLY
    headAdmin: '1513509662505304106',

    // ROLE / UNROLE APPROVAL ONLY
    admin: '1513509662505304106',

    // OPTIONAL MODERATOR
    moderator: '1513509664971817020',
  },

  /* =========================================================
     REQUEST SETTINGS
  ========================================================= */

  requests: {
    roleRequestAdminRoleId: '1513509662505304106',
    unroleRequestChannelId: '1513509530842038363',
  },

  /* =========================================================
     VISUALS
  ========================================================= */

  images: {
    thumbnail:
      'https://media.discordapp.net/attachments/1508361405907079182/1513509171268423710/content.png?ex=6a28a582&is=6a275402&hm=a7660b4d3e867cdb7405f32210484b9181b7eb40f5e2765734af264775b268a8&=&format=webp&quality=lossless&width=968&height=968',
  },

  /* =========================================================
     SERVER ROLES
  ========================================================= */

  serverRoles: {
    citizen: '1513509705232683068',
    unverified: '1513509723532558456',
  }
};