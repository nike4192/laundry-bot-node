
const { isEqual } = require('date-fns');
const { Op } = require('sequelize');
const misc = require("../misc.js");
const { Markup } = require("telegraf");
const { BaseAction, BaseMessage, BaseForm } = require('./base.js');
const { User, SummaryData, Appointment, AppointmentData } = require('../models.js');

class SummaryDateAction extends BaseAction {
  constructor() {
    super('Дата', 'Выберите дату');
  }

  async text(data) {
    return '📅 ' + this.actionText;
  }

  async replyMarkup(user, data, state) {
    let availableDates = misc.getAvailableDates(user.role);

    let keyboard = [];
    for (let d of availableDates) {
      let appointmentsCount = await Appointment.count({
        where: {book_date: d}
      });
      let dateStr = misc.dateButtonToStr(d);
      let keyboardButton = Markup.button.callback(
        appointmentsCount
          ? `${dateStr} - ${appointmentsCount}`
          : dateStr,
        [state, misc.date.stringify(d)].join(' ')
      );
      keyboard.push([keyboardButton]);
    }
    return Markup.inlineKeyboard(keyboard);
  }

  async buttonHandler(user, data, value) {
    await data.update({ summary_date: misc.date.parse(value) });
    return [true, ''];
  }
}

class SummaryInfoMessage extends BaseMessage {

  parseMode = 'MarkdownV2';

  async text(data) {
    let appointmentDataArray = await AppointmentData.findAll({
      where: {
        book_date: data.summary_date
      },
      order: [
        ['book_date', 'ASC'],
        ['book_time', 'ASC']
      ],
      include: [
        {model: Appointment, include: {all: true}},
        {model: User}
      ]
    });

    let msgText = misc.md2Escape(misc.dateToStr(data.summary_date)) + '\n\n';
    let accumTime;
    for (let data of appointmentDataArray) {
      let user = data.user;
      let washers = data.appointments.map(a => a.washer);
      if (data.appointments?.length) {
        if (!isEqual(accumTime, data.book_time)) {
          accumTime = data.book_time;
          msgText += misc.format(data.expired ? '~{}~' : '*{}*', misc.timeToStr(accumTime)) + '\n';
        }

        msgText += [
          misc.format('\\- @{}', misc.md2Escape(user.username || '')),
          misc.format('||{}||',
            misc.md2Escape(user.first_name || '')),
          misc.format('\\({}\\)\n', misc.washersToStr(washers))
        ].join(' \\- ');
      }
    }

    return msgText;
  }
}

class SummaryForm extends BaseForm {
  actions = [
    new SummaryDateAction(),
    new SummaryInfoMessage()
  ]

  protectContent = true;

  static _dataClass = SummaryData;

  async findExistsDataArray() {
    return await SummaryData.findAll({
      where: {
        id: {[Op.ne]: this.data.id},
        user_id: this.data.user_id,
        summary_date: this.data.summary_date
      }
    });
  }
}

module.exports = {
  SummaryForm
}
