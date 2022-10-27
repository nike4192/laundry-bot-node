
const { Op } = require('sequelize');
const { User, Appointment, AppointmentData, SummaryData, Washer } = require('../models.js');

const { Markup } = require('telegraf');
const { BaseAction, BaseForm } = require('./base');
const misc = require('../misc');
const constants = require("../constants.js");
const locales = require('../../locales/index.js');
const { expandSlots, getLocale, AppointmentSlot} = require("../misc");
const { SummaryForm } = require('./summary.js');
const {hoursToMilliseconds} = require("date-fns");


class DateAppointmentAction extends BaseAction {
  constructor() {
    super('Дата', 'Выберите дату');
  }

  async isAvailableSlot(user, data, value) {
    let times = constants.available_time.map(t => {
      let d = new Date();
      d.setHours(0, 0, 0, t);
      return misc.time.stringify(d);
    });

    let appointments = await Appointment.findAll({
      where: {
        book_date: misc.date.parse(value),
        book_time: {
          [Op.in]: times
        }
      }
    });

    let washers = await Washer.findAll();
    let slots = expandSlots(new Date(), user, appointments, misc.date.parse(value), times, washers);
    return misc.aggregateAppointmentSlots(slots);
  }

  async replyMarkup(user, data, state) {
    let availableDates = misc.getAvailableDates(user.role);

    let keyboard = [];
    for (let date of availableDates) {
      let slot = await this.isAvailableSlot(user, data, misc.date.stringify(date));
      let signChar = constants.WASHER_SIGN_CHARS[slot.reason][Number(slot.available)];
      let keyboardButton = Markup.button.callback(
        (signChar ? signChar + ' ' : '') + misc.dateButtonToStr(date),
        [state, misc.date.stringify(date)].join(' ')
      );
      keyboard.push([keyboardButton]);
    }
    return Markup.inlineKeyboard(keyboard);
  }

  itemStringify(data) {
    return misc.dateToStr(data.book_date);
  }

  async buttonHandler(user, data, value) {
    let slot = await this.isAvailableSlot(user, data, value);
    if (slot.available) {
      await data.update({ book_date: value });
      return [true, ''];
    } else {
      let locale = getLocale('appointment_form', 'date_action');
      let localeKey = constants.WASHER_REASON_LOCALE_MAP[slot.reason];
      return [false, locale[localeKey]];
    }
  }
}

class TimeAppointmentAction extends BaseAction {
  constructor() {
    super('Время', 'Выберите время');
  }

  async isAvailableSlot(user, data, value) {
    let appointments = await Appointment.findAll({
      where: {
        book_date: data.book_date,
        book_time: misc.time.parse(value)
      }
    });
    let washers = await Washer.findAll();
    let slots = expandSlots(new Date(), user, appointments, data.book_date, [value], washers);

    return misc.aggregateAppointmentSlots(slots);
  }

  async replyMarkup(user, data, state) {
    let now = new Date();

    let keyboard = [];
    for (let t of constants.available_time) {
      if (now.valueOf() < data.book_date.valueOf() + t) {
        let d = new Date();
        d.setHours(0, 0, 0, t);
        let slot = await this.isAvailableSlot(user, data, misc.time.stringify(d));
        let signChar = constants.WASHER_SIGN_CHARS[slot.reason][Number(slot.available)];
        let keyboardButton = Markup.button.callback(
          (signChar ? signChar + ' ' : '') + misc.timeToStr(d),
          [state, misc.time.stringify(d)].join(' ')
        );
        keyboard.push([keyboardButton]);
      }
    }
    return Markup.inlineKeyboard(keyboard);
  }

  async buttonHandler(user, data, value) {
    let slot = await this.isAvailableSlot(user, data, value);
    if (slot.available) {
      await data.update({ book_time: value });
      return [true, ''];
    } else {
      let locale = getLocale('appointment_form', 'time_action');
      let localeKey = constants.WASHER_REASON_LOCALE_MAP[slot.reason];
      let errorText = slot.reason === constants.APPOINTMENT_IS_RESERVED
        ? misc.format(
          locale[localeKey],
          misc.timedelta.stringify(hoursToMilliseconds(constants.book_time_left)))
        : locale[localeKey];
      return [false, errorText];
    }
  }

  itemStringify(data) {
    return misc.timeToStr(data.book_time);
  }
}

class WashersAppointmentAction extends BaseAction {
  constructor() {
    super('Стиральные машины', 'Выберите стиральные машины');
  }

  async replyMarkup(user, data, state) {
    let washers = await Washer.findAll();

    let keyboard = [];
    for (let washer of washers) {
      let slot = await this.isAvailableSlot(user, data, washer.id);
      let signChar = constants.WASHER_SIGN_CHARS[slot.reason][Number(slot.available)];
      let keyboardButton = Markup.button.callback(
        (signChar ? signChar + ' ' : '') + washer.name,
        [state, washer.id].join(' ')
      );
      keyboard.push(keyboardButton);
    }
    return Markup.inlineKeyboard([keyboard]);
  }

  async isAvailableSlot(user, data, value) {
    let now = new Date();
    let bookDate = data.book_datetime;

    if (now > bookDate - hoursToMilliseconds(constants.book_time_left)) {
      return new AppointmentSlot(false, constants.APPOINTMENT_IS_RESERVED, null);
    }
    if (now > bookDate) {
      return new AppointmentSlot(false, constants.APPOINTMENT_IS_PASSED, null);
    }

    let appointment = await Appointment.findOne({
      where: {
        book_date: data.book_date,
        book_time: data.book_time,
        washer_id: parseInt(value)
      }
    });
    let washer = await Washer.findByPk(parseInt(value));
    return misc.getAppointmentSlot(user, appointment, washer);
  }

  itemStringify(data) {
    if (data.appointments && data.appointments.length) {
      return misc.washersToStr(data.appointments.map(a => a.washer));
    } else {
      return '...';
    }
  }

  async buttonHandler(user, data, value) {
    let slot = await this.isAvailableSlot(user, data, value);
    let locale = misc.getLocale('appointment_form', 'washer_action');

    if (slot.available) {
      if (slot.reason === constants.WASHER_IS_AVAILABLE) {
        let plannedAppointments = await Appointment.findPlanned(user);
        let maxBookWashers = constants.max_book_washers[user.role];
        if (plannedAppointments.length >= maxBookWashers) {
          let errorText = misc.format(locale['max_book_washers'], maxBookWashers);
          return [false, errorText];
        }
        await Appointment.create({
          user_id: user.id,
          data_id: data.id,
          book_date: data.book_date,
          book_time: data.book_time,
          washer_id: parseInt(value)
        });
        await data.reload();
        return [true, ''];
      } else if (slot.reason === constants.WASHER_IS_ALREADY_BOOKED) {
        await slot.appointment.destroy();
        await data.reload();
        return [true, ''];
      }
    } else {  // Not available
      let localeKey = constants.WASHER_REASON_LOCALE_MAP[slot.reason];
      return [false, locale[localeKey]];
    }
  }
}


class AppointmentForm extends BaseForm {

  actions = [
    new DateAppointmentAction(),
    new TimeAppointmentAction(),
    new WashersAppointmentAction()
  ];

  constructor(...args) {
    super(...args);

    this.reserved = false;
    this.passed = false;

    if (this.data.state === this.actions.length - 1) {
      let now = new Date();
      let bookDate = this.data.book_datetime;
      if (now > bookDate - hoursToMilliseconds(constants.book_time_left)) {
        this.reserved = true;
      }
      if (now > bookDate) {
        this.passed = true;
      }
    }
  }

  static _dataClass = AppointmentData;

  finishedText = locales.ru['appointment_form']['finished_title']

  async findExistsDataArray() {
    let data = this.data;
    return await AppointmentData.findAll({
      where: {
        id: {[Op.ne]: data.id},
        user_id: data.user_id,
        book_date: data.book_date,
        book_time: data.book_time
      },
      attributes: ['id', 'message_id', 'user_id']
    });
  }

  async takeAffect(ctx) {
    let data = this.data;
    let dataArray = await AppointmentData.findAll({
      where: {
        id: {
          [Op.ne]: data.id
        },
        [Op.or]: [
          {
            book_date: data.book_date,
            book_time: data.book_time,
            state: 2
          },
          {
            book_date: data.book_date,
            state: 1
          },
          {
            state: 0
          }
        ]
      },
      include: [
        User, {
          model: Appointment,
          include: Washer
        }
      ]
    });

    console.log('AppointmentData takeAffect: ', dataArray.length);
    await Promise.all(dataArray.map(d => {
      new AppointmentForm(d.user, d).updateMessage(ctx, true);
    }));

    let summaryDataArray = await SummaryData.findAll({
      where: {
        [Op.or]: [
          {
            summary_date: data.book_date,
            state: 1
          },
          {
            state: 0
          }
        ]
      },
      include: [User]
    });
    console.log('SummaryData takeAffect: ', summaryDataArray.length);
    await Promise.all(summaryDataArray.map(d => {
      new SummaryForm(d.user, d).updateMessage(ctx, true);
    }));
  }

  get titleText() {
    let locale = getLocale('appointment_form');
    if (this.passed) {
      return '📅 ' + locale['passed_title'];
    } else if (this.reserved) {
      return '⌛ ' + locale['reserved_title'];
    } else {
      return super.titleText;
    }
  }

  async replyMarkup() {
    if (!this.passed && !this.reserved) {
      return await super.replyMarkup();
    } else {
      return null;
    }
  }

  async close(reason, telegram) {
    if (reason === constants.APPOINTMENT_IS_PASSED) {
      this.passed = true;
    } else if (reason === constants.APPOINTMENT_IS_RESERVED) {
      this.reserved = true;
    }
    await super.close(reason, telegram);
  }

  get finished() {
    return this.data.appointments?.length;
  }
}

module.exports = {
  AppointmentForm
}