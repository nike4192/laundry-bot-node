
const { Op } = require('sequelize');
const { BaseAction, BaseForm } = require("./base.js");
const { Markup } = require("telegraf");
const constants = require("../constants.js");
const locales = require('../../locales/index.js');
const misc = require("../misc.js");
const { Reminder, ReminderData } = require('../models.js');


class ReminderAction extends BaseAction {
  constructor() {
    super('Уведомления', 'Выберите за сколько вас предупредить');
  }

  async replyMarkup(user, data, state) {
    let keyboard = [];
    for (let rt of constants.reminder_timedelta) {
      let seconds = rt / 1000;
      let [_, reason] = await this.isAvailableSlot(user, data, seconds);
      let signChar = reason ? '✅' : null;
      let keyboardButton = Markup.button.callback(
        (signChar ? signChar + ' ' : '') + misc.timedelta.stringify(rt),
        [state, seconds].join(' ')
      );
      keyboard.push(keyboardButton);
    }
    return Markup.inlineKeyboard([keyboard]);
  }

  async isAvailableSlot(user, data, value) {
    let reminder = await Reminder.findOne({
      where: {
        seconds: parseInt(value),
        user_id: user.id
      }
    });
    return [true, Boolean(reminder), reminder];
  }

  itemStringify(data) {
    if (data.reminders?.length) {
      return '\n- ' + data.reminders
        .sort((a, b) => a.seconds - b.seconds)
        .map(r => misc.timedelta.stringify(r.seconds * 1000))
        .join('\n- ');
    } else {
      return '...';
    }
  }

  async buttonHandler(user, data, value) {
    let [_, reason, reminder] = await this.isAvailableSlot(user, data, value);

    if (reason) {
      await reminder.destroy();
    } else {
      await Reminder.create({
        seconds: parseInt(value),
        data_id: data.id,
        user_id: user.id
      });
    }
    await data.reload({
      include: [Reminder]
    });
    return [true, ''];
  }
}

class ReminderForm extends BaseForm {
  actions = [
    new ReminderAction()
  ]

  static _dataClass = ReminderData

  finishedText = locales.ru['reminder_form']['finished_title'];

  async findExistsDataArray() {
    return await ReminderData.findAll({
      where: {
        id: {[Op.ne]: this.data.id},
        user_id: this.user.id
      },
      include: [Reminder]
    });
  }

  get finished() {
    return !! this.data.reminders?.length;
  }
}

module.exports = {
  ReminderForm
}
