
const { Sequelize, Model, DataTypes, Op } = require('sequelize');
const misc = require('./misc.js');
const UserRoles = DataTypes.ENUM('user', 'moderator', 'employee');

class User extends Model {}
class Message extends Model {}

class Appointment extends Model {
  static book_datetime_col = Sequelize.fn('TIMESTAMP',
    Sequelize.col('`appointments`.`book_date`'),
    Sequelize.col('`appointments`.`book_time`'));
  static async findPlanned(user, extra) {
    let now = new Date();
    return await Appointment.findAll({
      where: [
        Sequelize.where(
          Appointment.book_datetime_col,{[Op.gte]: now}
        ),
        {user_id: user.id}
      ],
      ...extra
    });
  }
}
class AppointmentData extends Model {
  static book_datetime_col = Sequelize.fn('TIMESTAMP',
    Sequelize.col('`appointment_data`.`book_date`'),
    Sequelize.col('`appointment_data`.`book_time`'));
  static targetModel = Appointment;
}

class Reminder extends Model {}
class ReminderData extends Model {
  static targetModel = Reminder;
}

class SummaryData extends Model {}

class Washer extends Model {}

async function initModels(sequelize) {

  User.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    order_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true
    },
    chat_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    role: {
      type: UserRoles,
      allowNull: false
    }
  }, {
    modelName: 'users',
    timestamps: false,
    sequelize
  });

  Message.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    }
  }, {
    modelName: 'messages',
    timestamps: false,
    sequelize
  });


  Appointment.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    book_date: {
      type: DataTypes.DATEONLY,
      get: function() {
        let value = this.getDataValue('book_date');
        return value ? misc.date.parse(value) : null;
      },
      allowNull: true
    },
    book_time: {
      type: DataTypes.TIME,
      get: function() {
        let value = this.getDataValue('book_time');
        return value ? misc.time.parse(value) : null;
      },
      allowNull: true
    },
    data_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER
    },
    washer_id: {
      type: DataTypes.INTEGER
    }
  }, {
    modelName: 'appointments',
    timestamps: false,
    sequelize
  });

  AppointmentData.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    state: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    book_date: {
      type: DataTypes.DATEONLY,
      get: function() {
        let value = this.getDataValue('book_date');
        return value ? misc.date.parse(value) : null;
      },
      allowNull: true
    },
    book_time: {
      type: DataTypes.TIME,
      get: function() {
        let value = this.getDataValue('book_time');
        return value ? misc.time.parse(value) : null;
      },
      allowNull: true
    },
    book_datetime: {
      type: DataTypes.VIRTUAL,
      get: function () {
        let d = this.book_date;
        let t = this.book_time;
        d.setHours(t.getHours(), t.getMinutes(), 0, 0);
        return d;
      }
    },
    expired: {
      type: DataTypes.VIRTUAL,
      get: function () {
        let now = new Date();
        return now >= this.book_datetime;
      }
    },
    reserved: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    modelName: 'appointment_data',
    timestamps: false,
    sequelize
  });

  Message.hasOne(AppointmentData, {foreignKey: 'message_id'});
  AppointmentData.belongsTo(Message, {foreignKey: 'message_id'});

  User.hasMany(AppointmentData, {foreignKey: 'user_id'});
  AppointmentData.belongsTo(User, {foreignKey: 'user_id'});

  AppointmentData.hasMany(Appointment, {foreignKey: 'data_id'});
  Appointment.belongsTo(AppointmentData, {foreignKey: 'data_id', as: 'data'});

  Reminder.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    seconds: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    data_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    modelName: 'reminders',
    timestamps: false,
    sequelize
  });

  User.hasMany(Reminder, {foreignKey: 'user_id'});
  Reminder.belongsTo(User, {foreignKey: 'user_id'});

  ReminderData.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    state: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    modelName: 'reminder_data',
    timestamps: false,
    sequelize
  });

  User.hasMany(ReminderData, {foreignKey: 'user_id'});
  ReminderData.belongsTo(User, {foreignKey: 'user_id'});

  ReminderData.hasMany(Reminder, {foreignKey: 'data_id'});
  Reminder.belongsTo(ReminderData, {foreignKey: 'data_id'});


  SummaryData.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    state: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    summary_date: {
      type: DataTypes.DATEONLY,
      get: function() {
        let value = this.getDataValue('summary_date');
        return value ? misc.date.parse(value) : null;
      },
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    modelName: 'summary_data',
    timestamps: false,
    sequelize
  });

  User.hasMany(SummaryData, {foreignKey: 'user_id'});
  SummaryData.belongsTo(User, {foreignKey: 'user_id'});

  Washer.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(30)
    },
    available: {
      type: DataTypes.BOOLEAN
    }
  }, {
    modelName: 'washers',
    timestamps: false,
    sequelize
  });

  Washer.hasOne(Appointment, {foreignKey: 'washer_id'});
  Appointment.belongsTo(Washer, {foreignKey: 'washer_id'});
}

module.exports = {
  initModels,
  UserRoles, User, Message,
  Appointment, AppointmentData,
  Reminder, ReminderData,
  SummaryData,
  Washer
}
