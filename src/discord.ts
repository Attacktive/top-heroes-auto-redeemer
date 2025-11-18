import {
	Client,
	GatewayIntentBits,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	REST,
	Routes,
	Message
} from 'discord.js';
import { userStore } from './user-store.js';
import { useRedeemer } from './redeemer.js';

const extractGiftCode = (message: string) => {
	const pattern = /🎁\s*Gift\s*Code\s+#\s*([0-9A-F]+\b)/i;
	const match = pattern.exec(message);
	if (match) {
		return match[1];
	}

	return undefined;
};

const ADD_USER_COMMAND_NAME = 'add-user' as const;
const REMOVE_USER_COMMAND_NAME = 'remove-user' as const;
const CLEAR_USERS_COMMAND_NAME = 'clear-users' as const;
const LIST_USERS_COMMAND_NAME = 'list-users' as const;
const REDEEM_COMMAND_NAME = 'redeem' as const;
const REDEEM_FOR_ALL_COMMAND_NAME = 'redeem-bulk' as const;
const SERVERS_COMMAND_NAME = 'servers' as const;
const VERSION_COMMAND_NAME = 'version' as const;

const addUserCommand = new SlashCommandBuilder()
	.setName(ADD_USER_COMMAND_NAME)
	.setDescription('Add a user ID to the redemption list')
	.addStringOption(option => option.setName('user-id')
		.setDescription('The user ID to add')
		.setRequired(true)
	)
	.toJSON();

const removeUserCommand = new SlashCommandBuilder()
	.setName(REMOVE_USER_COMMAND_NAME)
	.setDescription('Remove a user ID from the redemption list')
	.addStringOption(option => option.setName('user-id')
		.setDescription('The user ID to remove')
		.setRequired(true)
	)
	.toJSON();

const clearUsersCommand = new SlashCommandBuilder()
	.setName(CLEAR_USERS_COMMAND_NAME)
	.setDescription('Clear all user IDs from the redemption list')
	.toJSON();

const listUsersCommand = new SlashCommandBuilder()
	.setName(LIST_USERS_COMMAND_NAME)
	.setDescription('List all current user IDs')
	.toJSON();

const redeemCommand = new SlashCommandBuilder()
	.setName('redeem')
	.setDescription('Manually redeem a gift code for the specified user')
	.addStringOption(option => option.setName('code')
		.setDescription('The gift code to redeem')
		.setRequired(true)
	)
	.addStringOption(option => option.setName('user-id')
		.setDescription('The user ID to get rewarded')
		.setRequired(true)
	)
	.toJSON();

const redeemBulkCommand = new SlashCommandBuilder()
	.setName(REDEEM_FOR_ALL_COMMAND_NAME)
	.setDescription('Manually redeem a gift code for every registered user')
	.addStringOption(option => option.setName('code')
		.setDescription('The gift code to redeem')
		.setRequired(true)
	)
	.toJSON();

const serversCommand = new SlashCommandBuilder()
	.setName(SERVERS_COMMAND_NAME)
	.setDescription('List all servers (guilds) the bot has joined')
	.toJSON();

const versionCommand = new SlashCommandBuilder()
	.setName(VERSION_COMMAND_NAME)
	.setDescription('Show bot version and build info')
	.toJSON();

const commands = [addUserCommand, removeUserCommand, clearUsersCommand, listUsersCommand, redeemCommand, redeemBulkCommand, serversCommand, versionCommand];

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

		await interaction.user.send(`👥 **Current Users:**
${userList}`);
	}

	await interaction.reply({
		content: 'The list of the users is kept secret. 🤫',
		flags: 'Ephemeral'
	});
};

const redeemForSingleUser = async (interaction: ChatInputCommandInteraction) => {
	const giftCode = interaction.options.getString('code', true);
	const userId = interaction.options.getString('user-id', true);
	const reply = await interaction.deferReply();

	const { redeem } = useRedeemer();
	const success = await redeem(giftCode, userId);
	if (success) {
		await reply.edit({ content: `✅ Successfully redeemed code \`${giftCode}\` for: ${userId}` });
	} else {
		await reply.edit({ content: `❌ Failed to redeem code \`${giftCode}\` for \`${userId}\`` });
	}
}

const redeemBulk = async (interaction: ChatInputCommandInteraction) => {
	const giftCode = interaction.options.getString('code', true);
	await interaction.deferReply();

	try {
		const { redeemForAll } = useRedeemer();
		const succeeded = await redeemForAll(giftCode);

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

const showServers = async (interaction: ChatInputCommandInteraction) => {
	const guilds = interaction.client.guilds.cache;
	const totalServers = guilds.size;

	if (totalServers === 0) {
		await interaction.reply({
			content: 'I\'m not currently in any servers! 😭',
			flags: 'Ephemeral'
		});

		return;
	}

	const allServerLines = guilds.map((guild, index) => `${index + 1}. **${guild.name}** (ID: \`${guild.id}\`) - ${guild.memberCount} members`);

	if (totalServers <= 5) {
		const serverList = allServerLines.join('\n');
		const content = `🌎 **Servers I'm In (${totalServers} Total):**
${serverList}`;

		await interaction.reply({ content, flags: 'Ephemeral' });
	} else {
		const limitedServerList = allServerLines.slice(0, 5).join('\n');

		const content = `🌎 **Servers I'm In (${totalServers} Total):**
${limitedServerList}
... and **${totalServers - 5}** more! Sending the full list in DM. 🤫`;

		await interaction.reply({ content, flags: 'Ephemeral' });

		const fullServerList = allServerLines.join('\n');

		await interaction.user.send(`🌎 **Full Server List (${totalServers} Total):**
${fullServerList}`);
	}
};

const showVersion = async (interaction: ChatInputCommandInteraction) => {
	const version = process.env.npm_package_version || 'unknown';
	const buildTime = process.env.BUILD_TIME || 'unknown';
	const gitTag = process.env.GIT_TAG || 'unknown';

	const content = `🤖 **Bot Version Info**\n` +
		`Version: \`${version}\`\n` +
		`Git Tag: \`${gitTag}\`\n` +
		`Build: \`${buildTime}\`\n` +
		`Node.js: \`${process.version}\``;

	await interaction.reply({ content, flags: 'Ephemeral' });
};

const handleMessageCreate = async ({ author, content, channel }: Message) => {
	if (!channel.isSendable()) {
		throw new Error('Cannot send a message through this channel. 😳');
	}

	const { id, globalName } = author;

	console.log(`💬 Message from ${globalName} (${id}): ${content}`);

	const giftCode = extractGiftCode(content);
	if (giftCode) {
		console.log(`🎁 Auto-detected gift code: ${giftCode}`);

		try {
			const { redeemForAll } = useRedeemer();
			const succeeded = await redeemForAll(giftCode);
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
};

const handleSlashCommand = async (interaction: ChatInputCommandInteraction) => {
	switch (interaction.commandName) {
		case ADD_USER_COMMAND_NAME:
			await addUser(interaction);
			break;
		case REMOVE_USER_COMMAND_NAME:
			await removeUser(interaction);
			break;
		case CLEAR_USERS_COMMAND_NAME:
			await clearUsers(interaction);
			break;
		case LIST_USERS_COMMAND_NAME:
			await listUsers(interaction);
			break;
		case REDEEM_COMMAND_NAME:
			await redeemForSingleUser(interaction);
			break;
		case REDEEM_FOR_ALL_COMMAND_NAME:
			await redeemBulk(interaction);
			break;
		case SERVERS_COMMAND_NAME:
			await showServers(interaction);
			break;
		case VERSION_COMMAND_NAME:
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

	client.on('messageCreate', handleMessageCreate);

	await registerCommands(TOKEN);
	await client.login(TOKEN);

	return client;
};
