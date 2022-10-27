
require('dotenv').config({
  path: process.env.NODE_ENV === 'test'
    ? '.env.test'
    : '.env'
});

const { fork } = require('node:child_process');

const { performance } = require('node:perf_hooks');
const { AppointmentForm } = require('./src/forms/appointment.js');
const { ReminderForm } = require('./src/forms/reminder.js');
const { SummaryForm } = require('./src/forms/summary.js');
const { cronUpdate } = require('./cron-update.js');
const authorize = require('./src/authorize.js');
const constants = require('./src/constants.js');
const misc = require('./src/misc.js');

const {
  authUserMiddleware,
  messageFormMiddleware,
  userPermissionMiddleware
} = require('./src/middleware.js')

const { loadSequelize, closeSequelize } = require('./src/sequelize.js');
const { User, Appointment, AppointmentData, ReminderData, SummaryData } = require('./src/models.js');

const { Telegraf, Context } = require('telegraf');
const { getLocale } = require("./src/misc");
const { Sequelize, Op } = require("sequelize");
const { loadRedis, getRedis } = require("./src/redis");


class CustomContext extends Context {
  // https://github.com/telegraf/telegraf/blob/3cbcd8e8476d26152667b0c6549b074d0349eb62/src/context.ts#L1235
  get effectiveMessage() {
    return this.message ??
      this.editedMessage ??
      this.callbackQuery?.message ??
      this.channelPost ??
      this.editedChannelPost
  }
}

const host = '127.0.0.1';
const port = 8000;

const bot = new Telegraf(process.env.BOT_TOKEN, {
  contextType: CustomContext
});

const sessionData = {};

function session() {
  return async function (ctx, next) {
    if (!ctx.session) {
      let fromId = ctx.from.id;
      if (!sessionData[fromId]) {
        sessionData[fromId] = {};
      }
      ctx.session = sessionData[fromId];
    }
    await next();
  }
}

function tookPerformance(name) {
  return async function (ctx, next) {
    let start = performance.now();
    await next();
    if (ctx && ctx.callbackQuery) {
      let extra = ctx.callbackQuery.data;
      console.log(new Date(), name, extra, '-', performance.now() - start, 'ms');
    } else {
      console.log(new Date(), name, '-', performance.now() - start, 'ms');
    }
  }
}

async function isAuthorizedUser(ctx) {
  return !! await User.count({
    where: {
      chat_id: ctx.chat.id
    }
  });
}

async function main(processes) {

  await loadRedis();
  let sequelize = await loadSequelize();

  bot.use(session());

  bot.start(async (ctx) => {
    if (await isAuthorizedUser(ctx)) {
      await ctx.reply('Для записи в прачечную введите комманду: /book');
    } else {
      let locale = getLocale('authorization');
      let startText = locale['start_text'];
      let actionText = misc.format(locale['action_text'], {cmd_: '/auth '});
      let authText = misc.format(locale['auth_text'], {cmd: '/auth'});
      await ctx.reply(`${startText}\n\n${actionText + authText}`, {
        parse_mode: 'Markdown'
      });
    }
  });

  bot.command('book',
    authUserMiddleware,
    tookPerformance('cmd:book'),
    async (ctx) => {
      let {authUser} = ctx.session;

      let data = await AppointmentData.create({user_id: authUser.id});
      let messageForm = new AppointmentForm(authUser, data);
      await messageForm.reply(ctx);
    });

  async function auth(ctx) {
    let locale = getLocale('authorization');

    let authorizedUser = await isAuthorizedUser(ctx);

    if (authorizedUser) {
      ctx.session.authFlag = false;
      let textPostfix = locale['auth_postfix'];
      let reason = constants.SELF_ALREADY_AUTHORIZED;
      let localeKey = constants.AUTH_REASON_LOCALE_MAP[reason];
      let msgText = misc.format(locale[localeKey], textPostfix);
      await ctx.deleteMessage(ctx.effectiveMessage.message_id);
      return await ctx.reply(msgText);
    }

    let args = ctx.args ?? ctx.update.message.text.split(/\s+/);
    if (!ctx.args) {
      args.shift(); // Shift command;
    }

    let firstName, lastName, orderNumber;
    let {first_name, last_name} = ctx.from;
    if ((args.length === 1)
      && first_name && last_name) {
      firstName = first_name;
      lastName = last_name;
    } else if (args.length === 3) {
      firstName = args[1];
      lastName = args[0];
    } else {
      ctx.session.authFlag = true;
      return await ctx.reply(
        misc.format(locale['action_text'], {cmd_:''}), {
          parse_mode: 'Markdown'
        }
      );
    }

    orderNumber = args[args.length - 1];

    let [authUser, reason] = await authorize(
      firstName, lastName, orderNumber,
      ctx.from.username || null, ctx.chat.id
    );

    if (reason !== constants.AUTH_NOT_FOUND) {
      await ctx.deleteMessage(ctx.message.message_id);
    }

    let textPostfix = locale['auth_postfix'];
    let localeKey = constants.AUTH_REASON_LOCALE_MAP[reason];
    let msgText = misc.format(locale[localeKey], textPostfix);

    await ctx.reply(msgText, {
      parse_mode: 'Markdown'
    });

    if (authUser) {
      ctx.session.authUser = authUser;
      ctx.session.authFlag = false;
    }
  }

  bot.command('auth', tookPerformance('cmd:auth'), auth);

  bot.command('remind',
    authUserMiddleware,
    tookPerformance('cmd:remind'),
    async ctx => {
      let authUser = ctx.session.authUser;

      let data = await ReminderData.create({user_id: authUser.id});
      let messageForm = new ReminderForm(authUser, data);
      await messageForm.reply(ctx);

      ctx.session.messageForm = messageForm;
    }
  );

  bot.command('my',
    authUserMiddleware,
    tookPerformance('cmd:my'),
    async ctx => {
      let {authUser} = ctx.session;
      let now = new Date();
      let appointmentDataArray = await AppointmentData.findAll({
        where: [
          Sequelize.where(
            AppointmentData.book_datetime_col,{[Op.gte]: now}
          ),
          {user_id: authUser.id}
        ],
        order: [
          ['book_date', 'ASC'],
          ['book_time', 'ASC']
        ],
        include: [
          {model: User},
          {
            model: Appointment,
            include: {all: true},
            required: true
          }
        ]
      });

      if (appointmentDataArray.length) {
        await Promise.all(appointmentDataArray.map(data => {
          new AppointmentForm(data.user, data)
            .close(constants.MESSAGE_IS_NOT_RELEVANT, ctx.telegram);
        }));

        await Promise.all(appointmentDataArray.map(data => {
          new AppointmentForm(data.user, data).reply(ctx);
        }));
      } else {
        await ctx.reply('На данный момент нет действующих записей');
      }
    }
  );

  bot.command('summary',
    authUserMiddleware,
    userPermissionMiddleware('moderator'),
    tookPerformance('cmd:summary'),
    async ctx => {
      let authUser = ctx.session.authUser;

      let data = await SummaryData.create({user_id: authUser.id});
      let messageForm = new SummaryForm(authUser, data);
      await messageForm.reply(ctx);

      ctx.session.messageForm = messageForm;
    }
  );

  bot.command('today',
    authUserMiddleware,
    userPermissionMiddleware('moderator'),
    tookPerformance('cmd:today'),
    async ctx => {
      let now = new Date();
      let authUser = ctx.session.authUser;
      let availableWeekdays = constants.available_weekdays[authUser.role];

      if (availableWeekdays.includes(now.getDay())) {
        let data = await SummaryData.create({
          user_id: authUser.id,
          summary_date: now,
          state: 1
        });
        let messageForm = new SummaryForm(authUser, data);
        await messageForm.reply(ctx);

        ctx.session.messageForm = messageForm;
      } else {
        let locale = getLocale();
        let weekdayText = locale['weekdays'][now.getDay()];
        let msgText = misc.format(locale['today_is'], weekdayText);
        await ctx.reply('☕ ' + msgText);
      }
    }
  );

  bot.on('message',
    tookPerformance('message'),
    async ctx => {
    if (ctx.session.authFlag && ctx.update.message?.text) {
      ctx.args = ctx.update.message.text.split(' ');
      return await auth(ctx);
    }
  })

  bot.on('callback_query',
    authUserMiddleware,
    messageFormMiddleware,
    tookPerformance('callback_query'),
    async ctx => {
      await ctx.answerCbQuery();
      let [state, value] = ctx.callbackQuery.data.split(/\s/);

      let messageForm = ctx.session.messageForm;
      await messageForm.buttonHandler(ctx, state, value);
      await messageForm.updateMessage(ctx);

      let redis = getRedis();
      if (
        messageForm instanceof AppointmentForm &&
        messageForm.data.state === messageForm.actions.length - 1
      ) {
        let userId = messageForm.user.id;
        let messageId = messageForm.data.message_id;
        let message = `${userId}:${messageId}`;
        await redis.publish('takeAffect', message);
      }
    });

  let redis = getRedis();

  let subscriber = redis.duplicate();
  await subscriber.connect();

  await subscriber.subscribe('updateUser', async (message) => {
    let chatId = message;
    if (sessionData[chatId]?.authUser) {
      await sessionData[chatId].authUser.reload();
    }
  });

  if (process.env.NODE_ENV === 'test') {
    await bot.launch();
  } else if (process.env.WEBHOOK_URL) {
    bot.startWebhook('/', null, port, host);
    await bot.telegram.setWebhook(process.env.WEBHOOK_URL);
    console.log('Webhook was set:', process.env.WEBHOOK_URL);
  }

  bot.catch(async err => {
    let adminBot = new Telegraf(process.env.ADMIN_BOT_TOKEN);
    await adminBot.telegram.sendMessage(process.env.ADMIN_CHAT_ID, err.stack);
    throw err;
  });

  // https://github.com/sequelize/sequelize/issues/7801#issuecomment-309708889
  let events = [
    {name: 'SIGINT', exitCode: 130 },
    {name: 'SIGTERM', exitCode: 143 }
  ]

  events.forEach(e => {
    process.once(e.name, () => {
      processes.forEach(p => p.kill(e.name));
      bot.stop(e.name);
      closeSequelize(sequelize)
        .then(() => {
          process.exit(e.exitCode);
        })
        .catch((err) => {
          console.error(err);
          process.exit(1);
        })
    })
  })
}

async function subscribe() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  await loadRedis();
  await loadSequelize();

  let redis = getRedis();
  let subscriber = redis.duplicate();
  await subscriber.connect();

  await subscriber.subscribe('close', async (message) => {
    let [chatId, messageId] = message.split(/:/);
    await bot.telegram.editMessageText(
      parseInt(chatId),
      parseInt(messageId),
      null,
      '⌛');
  });

  await subscriber.subscribe('takeAffect', async (message) => {
    let [userId, messageId] = message.split(/:/);
    let data = await AppointmentData.findOne({
      where: {
        user_id: parseInt(userId),
        message_id: parseInt(messageId)
      },
      include: {
        model: User
      }
    });
    let messageForm = new AppointmentForm(data.user, data);
    await messageForm.takeAffect(bot);
  })
}

async function schedule() {
  const cron = require('node-cron');

  await loadSequelize();

  cron.schedule('* * * * *', async () => {
    let now = new Date();
    await tookPerformance('cron-update')(null, async () => {
      await cronUpdate(now);
    })
  });
}

switch(process.argv[2]) {
  case 'subscriber':
    console.log('subscriber', process.pid);
    subscribe().then(_ => console.log('Subscriber started'));
    break;
  case 'scheduler':
    console.log('scheduler', process.pid);
    schedule().then(_ => console.log('Scheduler started'));
    break;
  default:
    console.log('main', process.pid);
    const controller = new AbortController();
    const { signal } = controller;
    const subscriber = fork(__filename, ['subscriber'], { signal });
    const scheduler = fork(__filename, ['scheduler'], { signal });
    main([subscriber, scheduler]).then(_ => console.log('App started'));
}
