
const { User } = require('./models.js');
const constants = require('./constants.js');

async function authorize(firstName, lastName, orderNumber, username, chatId) {
  let user = await User.findOne({
    where: {
      first_name: firstName,
      last_name: lastName,
      order_number: orderNumber
    }
  });

  if (user) {
    if (user.chat_id) {
      if (user.chat_id === chatId) {
        return [user, constants.SELF_ALREADY_AUTHORIZED];
      } else {
        return [null, constants.OTHER_ALREADY_AUTHORIZED];
      }
    } else {
      await user.update({username, chat_id: chatId});
      return [user, constants.AUTH_SUCCESSFUL];
    }
  } else {
    return [null, constants.AUTH_NOT_FOUND];
  }
}

module.exports = authorize;