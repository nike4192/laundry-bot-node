
const { Entity, Schema, Client } = require('redis-om');
const { createClient } = require('redis');

class AppointmentData extends Entity {}

const appointmentDataSchema = new Schema(
  AppointmentData, {
  userId: {type: 'number'},
  messageId: {type: 'number'},
  state: {type: 'number'},
  book_date: {type: 'date'}
});

let redis, client;

async function loadRedis() {

  redis = createClient();
  await redis.connect();

  client = await new Client().use(redis);

}

function getRedis() {
  return redis;
}

function getClient() {
  return client;
}

module.exports = {
  loadRedis,
  getRedis,
  getClient,
  appointmentDataSchema
}
