
require('dotenv').config({
  path: process.env.NODE_ENV === 'test'
    ? '.env.test'
    : '.env'
});

const { performance } = require('node:perf_hooks');
const { Sequelize, Op } = require("sequelize");
const { User, Message, Washer, Appointment, AppointmentData, Reminder, SummaryData } = require("./src/models.js");
const { AppointmentForm } = require('./src/forms/appointment.js');
const { Telegraf } = require("telegraf");
const constants = require('./src/constants.js');
const misc = require('./src/misc.js');
const { isEqual, hoursToMilliseconds } = require("date-fns");
const { loadSequelize, closeSequelize } = require("./src/sequelize.js");

const bot = new Telegraf(process.env.BOT_TOKEN);

async function cronUpdate(now) {

  let nowDate = new Date(now.valueOf());
  nowDate.setSeconds(0, 0);

  let moderators = await User.findAll({
    where: {
      role: 'moderator'
    },
    include: {
      model: Reminder
    }
  });

  let sendingMessages = []
  for (let moderator of moderators) {
    for (let reminder of moderator.reminders) {
      let bookDate = new Date(nowDate.valueOf() + reminder.seconds * 1000);
      let appointmentsCount = await Appointment.count({
        where: [
          Sequelize.where(
            Appointment.book_datetime_col, bookDate
          )
        ]
      });
      if (appointmentsCount) {
        let summaryDataArray = await SummaryData.findAll({
          where: {
            user_id: moderator.id,
            summary_date: bookDate
          },
          include: {
            model: User
          }
        });
        for (let summaryData of summaryDataArray) {
          if (summaryData.message_id) {
            let message = bot.telegram.sendMessage(
              summaryData.user.chat_id,
              misc.format('🔔 Через *{}* назначены стирки - {}',
                misc.timedelta.stringify(reminder.seconds * 1000),
                appointmentsCount), {
                reply_to_message_id: summaryData.message_id,
                parse_mode: 'Markdown'
              }
            );
            sendingMessages.push(message);
          }
        }
      }
    }
  }

  let appointmentDataArray = await AppointmentData.findAll({
    where: [
      Sequelize.where(
        AppointmentData.book_datetime_col, {[Op.gte]: nowDate}
      )
    ],
    include: [
      {model: User, include: [Reminder]},
      {model: Message, required: true},
      {
        model: Appointment,
        required: true,
        include: [Washer]
      }
    ]
  });

  let expiredForms = [];
  for (let appointmentData of appointmentDataArray) {
    let bookDate = appointmentData.book_datetime;
    if (nowDate >= bookDate - hoursToMilliseconds(constants.book_time_left)) {
      let closeReason;
      if (nowDate >= bookDate) {
        closeReason = constants.APPOINTMENT_IS_PASSED;  // PASSED
      } else {
        closeReason = constants.APPOINTMENT_IS_RESERVED;  // RESERVED
        if (appointmentData.reserved) continue;  // NOT MODIFY MESSAGE
        await appointmentData.update({ reserved: true });
      }
      console.log('Closed data', appointmentData.id, closeReason);
      let expiredForm = new AppointmentForm(appointmentData.user, appointmentData)
        .close(closeReason, bot.telegram);
      expiredForms.push(expiredForm);
    } else {
      let user = appointmentData.user;
      for (let reminder of user.reminders) {
        let notifyDate = bookDate - reminder.seconds * 1000;
        if (isEqual(nowDate, notifyDate)) {
          let message = bot.telegram.sendMessage(
            user.chat_id,
            misc.format(
              '🔔 Через *{}* назначена ваша стирка',
              misc.timedelta.stringify(reminder.seconds * 1000)), {
              parse_mode: 'Markdown',
              reply_to_message_id: appointmentData.message_id
            }
          );
          sendingMessages.push(message);
        }
      }
    }
  }

  await Promise.all(Array.prototype.concat.apply(
    Array.prototype,
    [sendingMessages, expiredForms]
  ));
}

async function main() {
  let now = new Date();

  let start = performance.now();

  let sequelize = await loadSequelize();
  await cronUpdate(now);
  await closeSequelize(sequelize);

  console.log(now, 'Took:', performance.now() - start, 'ms');
}

if (require.main === module) {
  main().then(/* pass */);
}

module.exports = {
  cronUpdate
}
