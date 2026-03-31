# Telegram Bot Setup Guide

Step-by-step instructions to set up the Contrib Telegram notification bot.

---

## 1. Create the bot

1. Open Telegram on your phone or desktop.
2. Search for **@BotFather** and open a chat with it.
3. Send the message: `/newbot`
4. BotFather will ask you for a **name** -- type something like: `Contrib Notifications`
5. BotFather will ask you for a **username** -- it must end in `bot`, for example: `contrib_notify_bot`
6. BotFather will reply with a **token** that looks like `123456789:ABCdefGHI...`. Copy this token -- you will need it in step 4.

## 2. Set bot commands

While still chatting with @BotFather:

1. Send: `/setcommands`
2. BotFather will ask you to choose a bot -- select the one you just created.
3. Send this exact message (both lines together):

```
start - Connect your Contrib account
help - How to use this bot
```

## 3. Set bot description

While still chatting with @BotFather:

1. Send: `/setdescription`
2. Select your bot.
3. Send: `Get real-time notifications from Contrib - your group contribution tracker`

## 4. Set environment variables

### For production (Vercel):

1. Go to your Vercel dashboard.
2. Open your Contrib project.
3. Go to **Settings** > **Environment Variables**.
4. Add these two variables:

| Name | Value |
|------|-------|
| `TELEGRAM_BOT_TOKEN` | The token from step 1 (from BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string -- you can generate one at randomkeygen.com (use the "Fort Knox Passwords" one) |

5. Click **Save** for each one.
6. **Redeploy** your project so the new variables take effect (go to Deployments, click the three dots on the latest one, and select "Redeploy").

### For local development (.env.local):

Add these lines to your `.env.local` file in the `contrib` folder:

```
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_WEBHOOK_SECRET=any_random_string
```

## 5. Register the webhook

After your site is deployed with the new environment variables:

1. Open your browser.
2. Visit this URL (replace the placeholder values with your own):

```
https://your-domain.com/api/telegram/setup?secret=YOUR_TELEGRAM_WEBHOOK_SECRET
```

For example, if your site is at `contrib-app.vercel.app` and your webhook secret is `my_secret_123`, visit:

```
https://contrib-app.vercel.app/api/telegram/setup?secret=my_secret_123
```

3. You should see a response that says **"Webhook registered"**. If you see an error, double-check that your `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` are set correctly in Vercel.

## 6. Test it

1. Go to your Contrib profile page (click your avatar, then "Profile").
2. Click **Connect Telegram**.
3. A 6-character code will appear on screen.
4. Open Telegram and find your bot (search for the username you chose in step 1).
5. Send the 6-character code to the bot.
6. The bot should reply **"Connected!"** and the profile page will update automatically.

---

## Troubleshooting

- **Bot does not respond:** Make sure you completed step 5 (webhook registration). The webhook must be registered after every new deployment domain.
- **"Code not found or expired":** The code expires after 10 minutes. Go back to Contrib and click "Connect Telegram" again to get a new code.
- **Environment variable not working:** After changing environment variables in Vercel, you must redeploy for them to take effect.
