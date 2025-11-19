import {
	Client,
	GatewayIntentBits,
	REST,
	Routes,
	Message
} from 'discord.js';
import { useRedeemer } from './redeemer.js';
import { commands, handleSlashCommand } from './discord-commands.js';

const extractGiftCode = (message: string) => {
	const pattern = /🎁\s*Gift\s*Code\s+#\s*([0-9A-F]+\b)/i;
	const match = pattern.exec(message);
	if (match) {
		return match[1];
	}

	return undefined;
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
