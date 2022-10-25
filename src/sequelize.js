
const { Sequelize } = require('sequelize');
const { initModels } = require("./models.js");

const {
  MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST
} = process.env;

async function loadSequelize() {
  const sequelize = new Sequelize(
    MYSQL_DB,
    MYSQL_USER,
    MYSQL_PASSWORD, {
      host: MYSQL_HOST,
      logging: false,
      dialect: 'mysql',
      timezone: '+05:00'
    });

  await initModels(sequelize);

  // await sequelize.sync({
  //   alter: true
  // });
  console.log('Sequelize synchronized');

  return sequelize;
}

async function closeSequelize(sequelize) {
  await sequelize.connectionManager.close();
  console.log('Sequelize connections closed');
}

module.exports = {
  loadSequelize, closeSequelize
};
