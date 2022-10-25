
const constants = require('./constants.js');
const locales = require('../locales');
const { differenceInDays, isEqual, hoursToMilliseconds} = require('date-fns');
const ms = require("ms");

function getLocale(...args) {
  let l = locales.ru;
  for (let p of args) {
    l = l[p];
  }
  return l;
}

function getAvailableDates(userRole) {
  let now = new Date();
  let d = new Date(now).setHours(0, 0, 0, 0).valueOf();
  let td = ms('1d');

  let availableWeekdays = constants.available_weekdays[userRole];
  let isNotAvailableTimes = constants.available_time.every(t => now.valueOf() > d + t);
  if (isNotAvailableTimes) {
    d += td;
  }
  let dates = [];
  let availableDays = constants.available_days[userRole];
  for (let i = 0; i < availableDays; i++) {
    while (!availableWeekdays.includes(new Date(d).getDay())) {
      d += td;
    }
    dates.push(new Date(d));
    d += td;
  }
  return dates;
}

function dateToStr(date) {
  let now = new Date();
  let rd = now.setHours(0, 0, 0, 0).valueOf();
  let deltaDays = differenceInDays(date, rd);

  let locale = getLocale();
  let d = date.getDate();
  let m = date.getMonth() + 1;
  let y = date.getFullYear();
  let additionals = 0 <= deltaDays && deltaDays < locale['shift_days'].length
    ? locale['shift_days'][deltaDays]
    : locale['weekdays'][date.getDay()];

  return `${d}.${m}.${y} (${additionals})`;
}

function dateButtonToStr(date) {
  let locale = getLocale();
  let d = String(date.getDate()).padStart(2, '0');
  let m = String(date.getMonth() + 1).padStart(2, '0');
  let wd = locale['short_weekdays'][date.getDay()];

  return `${d}.${m} (${wd})`;
}

const date = {
  stringify(date) {
    let y = String(date.getFullYear()).padStart(2, '0');
    let m = String(date.getMonth() + 1).padStart(2, '0');
    let d = String(date.getDate()).padStart(2, '0');
    return [y, m, d].join('-');
  },
  parse(s) {
    let [y, m, d] = s.split(/-/);
    return new Date(
      parseInt(y), parseInt(m) - 1, parseInt(d),
      0, 0, 0, 0);
  }
};

const timedelta = {
  stringify(td) {
    let pieces = [];
    let units = td / 1000;

    if (units >= 86400) {
      pieces.push(`${~~(units / 86400)} д.`);
      units -= ~~(units / 86400) * 86400;
    }
    if (units >= 3600) {
      pieces.push(`${~~(units / 3600)} ч.`);
      units -= ~~(units / 3600) * 3600;
    }
    if (units >= 60) {
      pieces.push(`${~~(units / 60)} мин.`);
      units -= ~~(units / 60) * 60;
    }
    if (units) {
      pieces.push(`${units} с.`);
    }

    return pieces.join(' ');
  }
}

function timeToStr(time) {
  let h = String(time.getHours()).padStart(2, '0');
  let m = String(time.getMinutes()).padStart(2, '0');

  return `${h}:${m}`;
}

const time = {
  stringify(time) {
    let h = String(time.getHours()).padStart(2, '0');
    let m = String(time.getMinutes()).padStart(2, '0');
    let s = String(time.getSeconds()).padStart(2, '0');

    return `${h}:${m}:${s}`;
  },
  parse(s) {
    let [h, m] = s.split(':');
    let now = new Date();
    now.setHours(parseInt(h), parseInt(m), 0, 0);
    return now;
  }
};

class AppointmentSlot {
  constructor(available, reason, appointment) {
    this.available = available;
    this.reason = reason;
    this.appointment = appointment;
  }

  equal(other) {
    return (
      this.available === other.available &&
      this.reason === other.reason
    )
  }
}

class ActionResult {
  constructor(success, errorText) {
    this.success = success;
    this.errorText = errorText;
  }
}

function washersToStr(washers) {
  return washers.map(w => w.name).sort().join(', ');
}

function aggregateAppointmentSlots(slots) {
  let levels = [
    new AppointmentSlot(true, constants.WASHER_IS_ALREADY_BOOKED),
    new AppointmentSlot(true, constants.WASHER_IS_AVAILABLE),
    new AppointmentSlot(false, constants.WASHER_IS_ALREADY_BOOKED),
    new AppointmentSlot(false, constants.APPOINTMENT_IS_PASSED),
    new AppointmentSlot(false, constants.APPOINTMENT_IS_RESERVED)
  ];

  for (let level of levels) {
    if (slots.some(slot => level.equal(slot))) {
      return level;
    }
  }
}

// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function md2Escape(s) {
  let specialCharacters = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let regexp = new RegExp(`(${specialCharacters.map(escapeRegex).join('|')})`, 'g');
  return s.replace(regexp, '\\$1')
}

function format(s, ...params) {
  let args = [];
  let props = {}
  for (let p of params) {
    if (typeof p === 'object') {
      if (Array.isArray(p)) {
        args = args.concat(p);
      } else {
        Object.assign(props, p);
      }
    } else {
      args.push(p);
    }
  }
  return s.replace(/\{(.*?)}/g, function(_, g) {
    return !g
      ? args.shift() :
      parseInt(g)
        ? args[parseInt(g)]
        : props[g];
  })
}

function getAppointmentSlot(user, appointment, washer) {
  if (!appointment) {
    if (!washer.available) {
      return new AppointmentSlot(false, constants.WASHER_IS_NOT_AVAILABLE, null);
    } else {
      return new AppointmentSlot(true, constants.WASHER_IS_AVAILABLE, null);
    }
  } else {
    return new AppointmentSlot(
      appointment.user_id === user.id,
      constants.WASHER_IS_ALREADY_BOOKED,
      appointment.user_id === user.id ? appointment : null)
  }
}

function expandSlots(at, user, appointments, d, times, washers) {
  let slots = [];
  for (let t of times) {
    let slotDate = new Date(d.valueOf());
    let td = time.parse(t);
    slotDate.setHours(td.getHours(), td.getMinutes(), 0, 0);

    if (at > slotDate - hoursToMilliseconds(constants.book_time_left)) {
      let reason = at > slotDate
        ? constants.APPOINTMENT_IS_RESERVED
        : constants.APPOINTMENT_IS_RESERVED;
      let slot = new AppointmentSlot(false, reason, null);
      slots.push(slot);
      continue;
    }
    for (let w of washers) {
      let matches = appointments.filter(a => {
        let bookDate = a.book_date;
        let bookTime = a.book_time;
        bookDate.setHours(bookTime.getHours(), bookTime.getMinutes(), 0, 0);
        return isEqual(bookDate, slotDate) &&
          a.washer_id === w.id
      });
      let appointment = matches.length ? matches[0] : null;
      slots.push(getAppointmentSlot(user, appointment, w));
    }
  }
  return slots;
}

module.exports = {
  aggregateAppointmentSlots,
  getAvailableDates,
  dateButtonToStr,
  AppointmentSlot,
  ActionResult,
  timeToStr,
  getAppointmentSlot,
  washersToStr,
  expandSlots,
  getLocale,
  dateToStr,
  md2Escape,
  format,
  timedelta,
  date,
  time
}
