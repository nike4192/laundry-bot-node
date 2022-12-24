
const ms = require('ms');
const { createDaysProxy } = require("./helpers");

const error_visible_duration = 2 // In seconds
const book_time_left = 0.5 // In hours (I don't know how it is in English)

const UserRole = {
  user: "user",
  "moderator:partial": "moderator:partial",
  moderator: "moderator",
  employee: "employee"
}

const holidays = createDaysProxy([
  new Date(2022, 11, 31),
  new Date(2023, 0, 1),
  new Date(2023, 0, 2),
]);

const holiday_part_day_time_ranges = [
  [
    ms('12h'),
    ms('13h') + ms('40min')
  ],
  [
    ms('21h'),
    ms('22h') + ms('40min')
  ]
]

const part_day_time_ranges = createDaysProxy({
  [new Date(2023, 0, 3)]: holiday_part_day_time_ranges,
  [new Date(2023, 0, 4)]: holiday_part_day_time_ranges,
  [new Date(2023, 0, 5)]: holiday_part_day_time_ranges,
  [new Date(2023, 0, 6)]: holiday_part_day_time_ranges,
  [new Date(2023, 0, 7)]: holiday_part_day_time_ranges,
});

const allWeekdays = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

const UserAttrs = {
  [UserRole.user]: {
    max_book_washers: 2,
    available_weekdays: [1, 2, 4, 5, 6],    // Mon, Tue, Thu, Fri, Sat
  },
  [UserRole["moderator:partial"]]: {
    max_book_washers: 2,
    available_weekdays: [1, 2, 4, 5, 6],    // Mon, Tue, Thu, Fri, Sat
  },
  [UserRole.moderator]: {
    max_book_washers: 3,
    available_weekdays: allWeekdays
  },
  [UserRole.employee]: {
    max_book_washers: 3,
    available_weekdays: allWeekdays
  }
}

const reminder_timedelta = [
  ms('5m'),
  ms('15m'),
  ms('1h'),
  ms('3h'),
  ms('1d')
]

const user_available_time_ranges = [
  [ms('10h'), ms('12h')],
  [ms('14h'), ms('16h')],
  [ms('18h'), ms('20h')],
  [ms('20h'), ms('22h')]
]

// AFTER 26.12.22 MOVE TO user_available_time_ranges
const new_user_available_time_ranges = [
  [
      ms('12h'),
      ms('13h') + ms('40min')
  ],
  [
      ms('15h'),
      ms('16h') + ms('40min')
  ],
  [
      ms('18h'),
      ms('19h') + ms('40min')
  ],
  [
      ms('21h'),
      ms('22h') + ms('40min')
  ]
]

const moderator_available_time_ranges = [
  [ms('10h'), ms('12h')],
  [ms('13h'), ms('15h')],
  [ms('16h'), ms('18h')],
  [ms('19h'), ms('21h')],
  [ms('22h'), ms('24h')]
]

const available_weekday_time_ranges = {
  1: user_available_time_ranges,       // Monday
  2: user_available_time_ranges,       // Tuesday
  3: moderator_available_time_ranges,  // Wednesday
  4: user_available_time_ranges,       // Thursday
  5: user_available_time_ranges,       // Friday
  6: user_available_time_ranges,       // Saturday
  0: moderator_available_time_ranges   // Sunday
}

// AFTER 26.12.22 MOVE TO available_weekday_time_ranges
const new_available_weekday_time_ranges = {
  1: new_user_available_time_ranges,   // Monday
  2: new_user_available_time_ranges,   // Tuesday
  3: moderator_available_time_ranges,  // Wednesday
  4: new_user_available_time_ranges,   // Thursday
  5: new_user_available_time_ranges,   // Friday
  6: new_user_available_time_ranges,   // Saturday
  0: moderator_available_time_ranges   // Sunday
}

const appointment_time_action_note = {
  '10:00': () => {
    return 'забрать следует в 12:00';
  }
}

const appointment_form_action_notes = {
  'time': {
    3: appointment_time_action_note,  // Wed
    0: appointment_time_action_note  // Sun
  }
}

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
  UserRole,
  UserAttrs,
  holidays,
  part_day_time_ranges,
  allWeekdays,
  error_visible_duration,
  book_time_left,
  reminder_timedelta,
  available_weekday_time_ranges,
  new_available_weekday_time_ranges,  // AFTER 26.12.22 MOVE TO available_weekday_time_ranges
  appointment_form_action_notes,
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
