import {
	Client,
	GatewayIntentBits,
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	REST,
	Routes,
	Message
} from 'discord.js';
import cron from 'node-cron';
import { userStore } from './user-store.js';
import { useRedeemer } from './redeemer.js';
import { analytics } from './analytics.js';

interface CheckInSchedule {
	activityId: number;
	daysRemaining: number;
	startDate: Date;
}

let schedule: CheckInSchedule | undefined = undefined;
let cronTask: cron.ScheduledTask | undefined = undefined;

const runDailyCheckIn = async () => {
	if (!schedule) {
		return;
	}

	try {
		console.log(`🔄 Running daily check-in for activity ID: ${schedule.activityId} (${schedule.daysRemaining} days remaining)`);
		const { checkIn } = useRedeemer();
		const succeeded = await checkIn(schedule.activityId);

		if (succeeded.length > 0) {
			console.log(`✅ Check-in successful for activity ${schedule.activityId}: ${succeeded.length} user(s)`);
		} else {
			console.log(`⚠️  Check-in completed but no users succeeded for activity ${schedule.activityId}`);
		}

		schedule.daysRemaining--;

		if (schedule.daysRemaining <= 0) {
			console.log(`🏁 Completed check-in schedule for activity ID: ${schedule.activityId}`);
			stopScheduler();
			schedule = undefined;
		}
	} catch (error) {
		const activityId = schedule?.activityId ?? 'unknown';
		console.error(`❌ Error running check-in for activity ${activityId}:`, error);
	}
};

const startScheduler = () => {
	if (cronTask) {
		return;
	}

	console.log('⏰ Starting daily check-in scheduler (02:00 UTC)');

	cronTask = cron.schedule(
		'0 2 * * *', () => {
			console.log(`🌙 Midnight GMT+02 detected, running daily check-in...`);

			runDailyCheckIn()
				.catch(error => console.error('❌ Error in daily check-in scheduler:', error));
		},
		{ timezone: 'UTC' }
	);
};

const stopScheduler = () => {
	if (cronTask) {
		cronTask.stop();
		cronTask = undefined;
		console.log('⏹️  Stopped daily check-in scheduler');
	}
};

const extractGiftCode = (message: string) => {
	const pattern = /🎁\s*Gift\s*Code\s+#\s*([0-9A-F]+\b)/i;
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

const serversCommand = new SlashCommandBuilder()
	.setName('servers')
	.setDescription('List all servers (guilds) the bot has joined')
	.toJSON();

const startCheckInCommand = new SlashCommandBuilder()
	.setName('start-check-in')
	.setDescription('Start daily check-in rewards collection for an event')
	.addIntegerOption(option => option.setName('activity-id')
		.setDescription('The activity ID for the sign-in event')
		.setRequired(true)
	)
	.addIntegerOption(option => option.setName('days')
		.setDescription('Event period length in days')
		.setRequired(true)
		.setMinValue(1)
	)
	.toJSON();

const checkInNowCommand = new SlashCommandBuilder()
	.setName('check-in-now')
	.setDescription('Manually trigger check-in rewards collection')
	.addIntegerOption(option => option.setName('activity-id')
		.setDescription('The activity ID for the sign-in event')
		.setRequired(true)
	)
	.toJSON();

const stopCheckInCommand = new SlashCommandBuilder()
	.setName('stop-check-in')
	.setDescription('Stop the active check-in schedule')
	.toJSON();

const commands = [addUserCommand, removeUserCommand, clearUsersCommand, listUsersCommand, redeemCommand, statsCommand, versionCommand, serversCommand, startCheckInCommand, checkInNowCommand, stopCheckInCommand];

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

const redeemManually = async (interaction: ChatInputCommandInteraction) => {
	const giftCode = interaction.options.getString('code', true);
	await interaction.deferReply();

	try {
		const { redeem } = useRedeemer();
		const succeeded = await redeem(giftCode);
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

		for (const record of recent) {
			const status = record.success? '✅': '❌';
			const time = record.timestamp.toLocaleTimeString();
			content += `${status} \`${record.code}\` - ${time}\n`;
		}
	}

	await interaction.reply({ content, flags: 'Ephemeral' });
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

const startCheckIn = async (interaction: ChatInputCommandInteraction) => {
	const activityId = interaction.options.getInteger('activity-id', true);
	const days = interaction.options.getInteger('days', true);

	if (schedule) {
		await interaction.reply({
			content: `⚠️  A check-in schedule is already active (Activity ID: \`${schedule.activityId}\`, ${schedule.daysRemaining} days remaining). Use /stop-check-in to stop it first.`,
			flags: 'Ephemeral'
		});
		return;
	}

	schedule = {
		activityId,
		daysRemaining: days,
		startDate: new Date()
	};

	startScheduler();

	await interaction.reply({
		content: `✅ Started daily check-in schedule for activity ID \`${activityId}\` (${days} days). Check-ins will run at midnight GMT+02.`,
		flags: 'Ephemeral'
	});
};

const checkInNow = async (interaction: ChatInputCommandInteraction) => {
	const activityId = interaction.options.getInteger('activity-id', true);
	await interaction.deferReply();

	try {
		const { checkIn } = useRedeemer();
		const succeeded = await checkIn(activityId);

		if (succeeded.length === 0) {
			await interaction.editReply({ content: `❌ Failed to collect check-in rewards for activity ID \`${activityId}\` for any users` });
		} else {
			const successList = succeeded.map(id => `\`${id}\``).join(', ');
			await interaction.editReply({ content: `✅ Successfully collected check-in rewards for activity ID \`${activityId}\` for: ${successList}` });
		}
	} catch (error) {
		console.error('Manual check-in error:', error);
		await interaction.editReply({ content: `❌ Error collecting check-in rewards for activity ID \`${activityId}\`: ${error}` });
	}
};

const stopCheckIn = async (interaction: ChatInputCommandInteraction) => {
	if (!schedule) {
		await interaction.reply({
			content: '📝 No active check-in schedule',
			flags: 'Ephemeral'
		});
		return;
	}

	const activityId = schedule.activityId;
	stopScheduler();
	schedule = undefined;

	await interaction.reply({
		content: `🛑 Stopped check-in schedule for activity ID \`${activityId}\``,
		flags: 'Ephemeral'
	});
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
			const { redeem } = useRedeemer();
			const succeeded = await redeem(giftCode);
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
		case 'servers':
			await showServers(interaction);
			break;
		case 'start-check-in':
			await startCheckIn(interaction);
			break;
		case 'check-in-now':
			await checkInNow(interaction);
			break;
		case 'stop-check-in':
			await stopCheckIn(interaction);
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
