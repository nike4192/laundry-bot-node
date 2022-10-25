
const ms = require('ms');

const error_visible_duration = 2 // In seconds
const book_time_left = 0.5 // In hours (I don't know how it is in English)
const max_book_washers = 2
const available_days = {  // Showed buttons in washer select
  user: 5,
  moderator: 7,
  employee: 7
}

const reminder_timedelta = [
  ms('5m'),
  ms('15m'),
  ms('1h'),
  ms('3h'),
  ms('1d')
]

const available_weekdays = {
  user:      [1, 2, 4, 5, 6],    // Mon, Tue, Thu, Fri, Sat
  moderator: [1, 2, 3, 4, 5, 6, 0], // Mon, Tue, Wed, Thu, Fri, Sat
  employee:  [1, 2, 3, 4, 5, 6, 0]  // Mon, Tue, Wed, Thu, Fri, Sat
}

const available_time = [
  ms('10h'),
  ms('14h'),
  ms('18h'),
  ms('20h')
]

const SELF_ALREADY_AUTHORIZED = 0;
const OTHER_ALREADY_AUTHORIZED = 1;
const AUTH_SUCCESSFUL = 2;
const AUTH_NOT_FOUND = 3;

const MESSAGE_IS_NOT_RELEVANT = 4;

const WASHER_IS_AVAILABLE = 5;
const WASHER_IS_ALREADY_BOOKED = 6;
const WASHER_IS_NOT_AVAILABLE = 7;
const APPOINTMENT_IS_PASSED = 8;
const APPOINTMENT_IS_RESERVED = 9;

const AUTH_REASON_LOCALE_MAP = {
  [AUTH_SUCCESSFUL]: 'successful',
  [SELF_ALREADY_AUTHORIZED]: 'self_already_authorized',
  [OTHER_ALREADY_AUTHORIZED]: 'other_already_authorized',
  [AUTH_NOT_FOUND]: 'not_found'
}

const WASHER_REASON_LOCALE_MAP = {
  [WASHER_IS_ALREADY_BOOKED]: 'washer_is_already_booked',
  [WASHER_IS_NOT_AVAILABLE]: 'washer_is_not_available',
  [APPOINTMENT_IS_PASSED]: 'appointment_is_passed',
  [APPOINTMENT_IS_RESERVED]: 'appointment_is_reserved'
}

const WASHER_SIGN_CHARS = {  // not_available, available
  [WASHER_IS_AVAILABLE]:      [null, null],
  [WASHER_IS_ALREADY_BOOKED]: ['❌', '✅'],
  [WASHER_IS_NOT_AVAILABLE]:  ['🔧', null],
  [APPOINTMENT_IS_PASSED]:    ['⌛', null],
  [APPOINTMENT_IS_RESERVED]:  ['⌛', null]
}

module.exports = {
  error_visible_duration,
  book_time_left,
  max_book_washers,
  available_days,
  reminder_timedelta,
  available_weekdays,
  available_time,
  SELF_ALREADY_AUTHORIZED,
  OTHER_ALREADY_AUTHORIZED,
  AUTH_SUCCESSFUL,
  AUTH_NOT_FOUND,
  MESSAGE_IS_NOT_RELEVANT,
  WASHER_IS_AVAILABLE,
  WASHER_IS_ALREADY_BOOKED,
  WASHER_IS_NOT_AVAILABLE,
  APPOINTMENT_IS_PASSED,
  APPOINTMENT_IS_RESERVED,
  AUTH_REASON_LOCALE_MAP,
  WASHER_REASON_LOCALE_MAP,
  WASHER_SIGN_CHARS,
}
