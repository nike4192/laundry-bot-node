
const { User, Appointment, Washer } = require('./models.js');
const { AppointmentForm } = require('./forms/appointment.js');
const { ReminderForm } = require('./forms/reminder.js');
const { SummaryForm } = require('./forms/summary.js');
const misc = require("./misc.js");
const {getLocale} = require("./misc");


async function authUserMiddleware(ctx, next) {
  if (!ctx.session.authUser) {
    let user = await User.findOne({
      where: {chat_id: ctx.chat.id}
    });

    if (user) {
      ctx.session.authUser = user;
      await next();
    } else {
      let locale = misc.getLocale();
      let authText = locale['middlewares']['auth_user'];
      let actionText = misc.format(locale['authorization']['action_text'], {cmd_: '/auth '});
      await ctx.reply(`${authText}\n\n${actionText}`, {
        parse_mode: 'Markdown'
      });
    }
  } else {
    await next();
  }
}

function userPermissionMiddleware(...userRoles) {
  return async (ctx, next) => {
    let {authUser} = ctx.session;
    let locale = getLocale('middlewares');
    if (userRoles.includes(authUser.role)) {
      return await next();
    } else {
      await ctx.reply(locale['user_permission']);
    }
  }
}

async function messageFormMiddleware(ctx, next) {
  let {authUser, messageForm} = ctx.session;

  if (authUser) {
    if (
      !messageForm ||
      messageForm.data.message_id !== ctx.effectiveMessage.message_id
    ) {
      for (let MessageForm of [AppointmentForm, ReminderForm, SummaryForm]) {
        let FormData = MessageForm._dataClass;
        let data = await FormData.findOne({
          where: {
            user_id: authUser.id,
            message_id: ctx.effectiveMessage.message_id
          },
          include:
            FormData.targetModel ? {
            model: FormData.targetModel,
            include: {
              all: true
            }
          } : null
        });
        if (data) {
          ctx.session.messageForm = new MessageForm(authUser, data);
          await next();
          break;
        }
      }
    } else {
      await next();
    }
  }
}

module.exports = {
  authUserMiddleware,
  messageFormMiddleware,
  userPermissionMiddleware
}