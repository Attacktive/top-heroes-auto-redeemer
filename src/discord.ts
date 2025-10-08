import {
	Client,
	GatewayIntentBits,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	REST,
	Routes
} from 'discord.js';
import { userStore } from './user-store.js';
import { useRedeemer } from './redeemer.js';
import { analytics } from './analytics.js';

const extractGiftCode = (message: string) => {
	const pattern = /🎁\s*Gift\s*Code\s+#\s*([0-9A-F]{10})/i;
	const match = pattern.exec(message);
	if (match) {
		return match[1];
	}

	return undefined;
};

const addUserCommand = new SlashCommandBuilder()
	.setName('add-user')
	.setDescription('Add a user ID to the redemption list')
	.addStringOption(option => option.setName('user-id')
		.setDescription('The user ID to add')
		.setRequired(true)
	)
	.toJSON();

const removeUserCommand = new SlashCommandBuilder()
	.setName('remove-user')
	.setDescription('Remove a user ID from the redemption list')
	.addStringOption(option => option.setName('user-id')
		.setDescription('The user ID to remove')
		.setRequired(true)
	)
	.toJSON();

const clearUsersCommand = new SlashCommandBuilder()
	.setName('clear-users')
	.setDescription('Clear all user IDs from the redemption list')
	.toJSON();

const listUsersCommand = new SlashCommandBuilder()
	.setName('list-users')
	.setDescription('List all current user IDs')
	.toJSON();

const redeemCommand = new SlashCommandBuilder()
	.setName('redeem')
	.setDescription('Manually redeem a gift code')
	.addStringOption(option => option.setName('code')
		.setDescription('The gift code to redeem')
		.setRequired(true)
	)
	.toJSON();

const statsCommand = new SlashCommandBuilder()
	.setName('stats')
	.setDescription('Show redemption statistics')
	.toJSON();

const versionCommand = new SlashCommandBuilder()
	.setName('version')
	.setDescription('Show bot version and build info')
	.toJSON();

const commands = [addUserCommand, removeUserCommand, clearUsersCommand, listUsersCommand, redeemCommand, statsCommand, versionCommand];

const addUser = async (interaction: ChatInputCommandInteraction) => {
	const userId = interaction.options.getString('user-id', true);
	const added = userStore.add(userId);

	if (added) {
		await interaction.reply({
			content: `✅ Added user ID: \`${userId}\`\nTotal users: ${userStore.count()}`,
			flags: 'Ephemeral'
		});
	} else {
		await interaction.reply({
			content: `⚠️  User ID \`${userId}\` already exists!`,
			flags: 'Ephemeral'
		});
	}
};

const removeUser = async (interaction: ChatInputCommandInteraction) => {
	const userId = interaction.options.getString('user-id', true);
	const removed = userStore.remove(userId);

	if (removed) {
		await interaction.reply({
			content: `🗑️ Removed user ID: \`${userId}\`\nTotal users: ${userStore.count()}`,
			flags: 'Ephemeral'
		});
	} else {
		await interaction.reply({
			content: `❌ User ID \`${userId}\` not found!`,
			flags: 'Ephemeral'
		});
	}
};

const clearUsers = async (interaction: ChatInputCommandInteraction) => {
	const count = userStore.clear();
	await interaction.reply({
		content: `🧹 Cleared ${count} user ID(s)`,
		flags: 'Ephemeral'
	});
};

const listUsers = async (interaction: ChatInputCommandInteraction) => {
	const users = userStore.list();
	if (users.length === 0) {
		await interaction.user.send('📝 No user IDs configured');
	} else {
		const userList = users.map((id, index) => `${index + 1}. \`${id}\``).join('\n');

		await interaction.user.send('👥 **Current Users:**');
		await interaction.user.send(userList);
	}

	await interaction.reply({
		content: 'The list of the users is kept secret. 🤫',
		flags: 'Ephemeral'
	});
};

const redeemManually = async (interaction: ChatInputCommandInteraction) => {
	const giftCode = interaction.options.getString('code', true);
	await interaction.deferReply();

	try {
		const webClient = useRedeemer();
		const succeeded = await webClient.redeem(giftCode);
		succeeded.forEach(userId => analytics.addRecord(giftCode, userId, true));
		if (succeeded.length === 0) {
			await interaction.editReply({ content: `❌ Failed to redeem code \`${giftCode}\` for any users` });
		} else {
			const successList = succeeded.map(id => `\`${id}\``).join(', ');
			await interaction.editReply({ content: `✅ Successfully redeemed code \`${giftCode}\` for: ${successList}` });
		}
	} catch (error) {
		console.error('Manual redeem error:', error);
		await interaction.editReply({ content: `❌ Error redeeming code \`${giftCode}\`: ${error}` });
	}
};

const showStats = async (interaction: ChatInputCommandInteraction) => {
	const stats = analytics.getStats();
	const recent = analytics.getRecentRedemptions(5);
	let content = `📊 **Redemption Statistics**\n`;
	content += `Total Redemptions: ${stats.total}\n`;
	content += `Successful: ${stats.successful} (${stats.successRate}%)\n`;
	content += `Failed: ${stats.failed}\n`;
	content += `Unique Codes: ${stats.uniqueCodes}\n`;
	content += `Active Users: ${stats.uniqueUsers}\n\n`;
	if (recent.length > 0) {
		content += `🕒 **Recent Redemptions:**\n`;
		recent.forEach(record => {
			const status = record.success ? '✅' : '❌';
			const time = record.timestamp.toLocaleTimeString();
			content += `${status} \`${record.code}\` - ${time}\n`;
		});
	}
	await interaction.reply({ content, flags: 'Ephemeral' });
};

const showVersion = async (interaction: ChatInputCommandInteraction) => {
	const version = process.env.npm_package_version || 'unknown';
	const buildTime = process.env.BUILD_TIME || 'unknown';
	const gitTag = process.env.GIT_TAG || 'unknown';
	const uptime = Math.floor(process.uptime());
	const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
	
	const content = `🤖 **Bot Version Info**\n` +
		`Version: \`${version}\`\n` +
		`Git Tag: \`${gitTag}\`\n` +
		`Build: \`${buildTime}\`\n` +
		`Uptime: \`${uptimeStr}\`\n` +
		`Node.js: \`${process.version}\``;
	
	await interaction.reply({ content, flags: 'Ephemeral' });
};

const handleSlashCommand = async (interaction: ChatInputCommandInteraction) => {
	switch (interaction.commandName) {
		case 'add-user':
			await addUser(interaction);
			break;
		case 'remove-user':
			await removeUser(interaction);
			break;
		case 'clear-users':
			await clearUsers(interaction);
			break;
		case 'list-users':
			await listUsers(interaction);
			break;
		case 'redeem':
			await redeemManually(interaction);
			break;
		case 'stats':
			await showStats(interaction);
			break;
		case 'version':
			await showVersion(interaction);
			break;
		default:
			await interaction.reply({
				content: '❌ Unknown command',
				flags: 'Ephemeral'
			});
	}
};

const registerCommands = async (token: string) => {
	const APPLICATION_ID = process.env.APPLICATION_ID;
	if (!APPLICATION_ID) {
		throw new Error('The environment variable "APPLICATION_ID" is required for slash commands!');
	}

	const rest = new REST().setToken(token);

	try {
		console.log('🔄 Started refreshing application (/) commands...');

		await rest.put(
			Routes.applicationCommands(APPLICATION_ID),
			{ body: commands }
		);

		console.log('✅ Successfully reloaded application (/) commands');
	} catch (error) {
		console.error('❌ Error registering commands:', error);
	}
};

export const useDiscord = async () => {
	const TOKEN = process.env.TOKEN;
	if (!TOKEN) {
		throw new Error('The environment variable "TOKEN" is not found in environment variables!');
	}

	const CHANNEL_ID = process.env.CHANNEL_ID;
	if (!CHANNEL_ID) {
		throw new Error('The environment variable "CHANNEL_ID" is not found in environment variables!');
	}

	const client = new Client({
		intents: [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.MessageContent
		]
	});

	client.once(
		'clientReady',
		() => {
			const { user } = client;

			if (user) {
				console.log(`🤖 Discord bot logged in as ${user?.tag}!`);
			} else {
				console.log('🤖 Discord bot logged in.');
			}
		}
	);

	client.on(
		'interactionCreate',
		async (interaction) => {
			if (interaction.isChatInputCommand()) {
				await handleSlashCommand(interaction);
			}
		}
	);

	client.on(
		'messageCreate',
		async (message) => {
			const { author, content, channel } = message;
			const { id, globalName } = author;

			console.log(`💬 Message from ${globalName} (${id}): ${content}`);

			const giftCode = extractGiftCode(content);
			if (giftCode) {
				console.log(`🎁 Auto-detected gift code: ${giftCode}`);

				try {
					const webClient = useRedeemer();
					const succeeded = await webClient.redeem(giftCode);
					succeeded.forEach(userId => analytics.addRecord(giftCode, userId, true));
					if (succeeded.length > 0) {
						const successList = succeeded.map(id => `\`${id}\``).join(', ');
						await channel.send(`✅ Auto-redeemed code \`${giftCode}\` for: ${successList}`);
					} else {
						await channel.send(`❌ Failed to redeem code \`${giftCode}\` for any configured users`);
					}
				} catch (error) {
					console.error('Auto-redeem error:', error);
					await channel.send(`❌ Error auto-redeeming code \`${giftCode}\`: ${error}`);
				}
			}
		}
	);

	await registerCommands(TOKEN);
	await client.login(TOKEN);

	return client;
};
