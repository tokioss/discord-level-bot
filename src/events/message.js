const db = require("../schemas/level");
const cooldown = new Map();
const conf = require("../configs/config.json");
const ranks = require("../schemas/ranks");
const settings = require("../configs/settings.json");

module.exports = async (message) => {
  const prefix = settings.prefix.find((x) => message.content.toLowerCase().startsWith(x));
  if (message.channel.type === "dm" || message.author.bot || prefix) return;

  if (!cooldown.has(message.author.id)) cooldown.set(message.author.id, Date.now());
  const cool = cooldown.get(message.author.id);
  if (cool && (Date.now() - cool) > conf.xpCooldown) {
    cooldown.set(message.author.id, Date.now());
    const data = await db.findOne({ guildID: message.guild.id, userID: message.author.id });
    const level = data ? data.level : 1;
    const nextLevelXP = (!level ? 1 : level == 1 ? 2 : level) * conf.nextLevelXP;
    const xpPerLevel = conf.xpToAdd.toString().includes("-") ? conf.xpToAdd.split("-") : conf.xpToAdd;
    const xpToAdd = Array.isArray(xpPerLevel) ? Math.floor(Math.random() * (xpPerLevel[1] - xpPerLevel[0] + 1)) + xpPerLevel[0] : xpPerLevel;

    if (!data || data && data.totalXP % nextLevelXP !== 0) await db.findOneAndUpdate({ guildID: message.guild.id, userID: message.author.id }, { $inc: { totalXP: xpToAdd } }, { upsert: true });
    else {
      const newData = await db.findOneAndUpdate({ guildID: message.guild.id, userID: message.author.id }, { $inc: { level: 1 }, $set: { currentXP: 0} }, { upsert: true, new: true });
      const rank = await ranks.findOne({ guildID: message.guild.id, level: newData.level });
      const channel = message.guild.channels.cache.get(conf.levelLog);
      if (rank) {
        await message.member.roles.add(rank.roles);
        if (conf.removeOldRoles) {
          const oldRanks = await ranks.find({ guildID: message.guild.id, level: { $lt: newData.level } });
          oldRanks.filter((x) => x.roles.some((r) => message.member.roles.cache.has(r))).forEach((x) => message.member.roles.remove(x.roles));
        }
        if (channel) channel.send(`${message.member.toString()} üyesi level atladı ve \`${rank.roles.map((x) => message.guild.roles.cache.get(x).name).join(", ")}\` rol(leri) kazandı!`);
      }
      if (channel) channel.send(`${message.member.toString()} üyesi level atladı! \`${newData.level - 1} => ${newData.level}\``);
      message.channel.send(`${message.member.toString()} tebrikler, level atladın! \`${newData.level - 1} => ${newData.level}\``).then((x) => x.delete({ timeout: 10000 }));
    }
  }
};

module.exports.conf = {
  name: "message",
};
