# Top Heroes Auto Redeemer

Discord bot that automatically redeems gift codes for the game *Top Heroes*.

## Features

- 🎁 Auto-detects gift codes in Discord messages
- 👥 Manages multiple user IDs for redemption
- ⚡ Slash commands for user management
- 📊 Redemption statistics and analytics
- 🏥 Health check endpoint

## Commands

- `/add-user <user-id>` - Add user to redemption list
- `/remove-user <user-id>` - Remove user from list
- `/clear-users` - Clear all users
- `/list-users` - List all users (DM)
- `/redeem <code>` - Manually redeem code
- `/stats` - Show redemption statistics
- `/version` - Show bot version and build info

## Setup

```bash
npm ci
npm run dev
```

## Environment Variables

```env
TOKEN=discord_bot_token
CHANNEL_ID=discord_channel_id
APPLICATION_ID=discord_application_id
INITIAL_USER_IDS=user1,user2,user3
```
