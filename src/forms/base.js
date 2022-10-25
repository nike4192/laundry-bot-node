
const constants = require("../constants.js");
const misc = require('../misc.js');

const { Message } = require('../models.js');

class BaseAction {
  constructor(itemText, actionText) {
    this.itemText = itemText;
    this.actionText = actionText;
  }

  async isAvailableSlot(user, data, value) {
    // pass
  }
}

class BaseMessage extends BaseAction {}

class BaseForm {
  actions = [];

  protectContent = false;
  finishedText = null;

  constructor(user, data) {
    this.user = user;
    this.data = data;

    this.closed = false;
  }

  get finished() {
    // pass
  }

  get message() {
    return this.data.message;
  }

  set message(value) {
    this.data.message = value;
  }

  get activeAction() {
    return this.actions[this.data.state];
  }

  get titleText() {
    if (this.errorText) {
      return '🚫 ' + this.errorText;
    } else if (this.finished) {
      return '✅ ' + this.finishedText;
    } else {
      return (this.actions.length > 1
          ? `${this.data.state + 1}/${this.actions.length} `
          : '')
        + this.activeAction.actionText;
    }
  }

  async findExistsDataArray() {
    // pass
  }

  async allocateDataIfNecessary(ctx, cb) {
    let DataModel = this.data.constructor;
    let dataArray = await this.findExistsDataArray();
    if (dataArray.length) {
      let dataArrayIds = dataArray.map(d => d.id);

      try {
        await this.data.sequelize.transaction(async t => {
          if (DataModel.targetModel) {
            await DataModel.targetModel.update({
              data_id: this.data.id
            }, {
              where: {data_id: dataArrayIds},
              transaction: t
            });
          }
          await DataModel.destroy({
            where: {id: dataArrayIds},
            transaction: t
          });
        });
      } catch(e) {
        console.error(e);
      }

      await this.data.reload(DataModel.targetModel ? {
        include: {
          model: DataModel.targetModel,
          include: {
            all: true
          }
        }
      } : null);

      let result = await cb();

      if (dataArray.length) {
        await Promise.all(dataArray.map(d => {
          new this.constructor(this.user, d)
            .close(constants.MESSAGE_IS_NOT_RELEVANT, ctx.telegram);
        }));
      }

      return result;
    } else {
      return await cb();
    }
  }

  async buttonHandler(ctx, state, value) {
    this.data.state = state;
    let [result, errorText] = await this.activeAction.buttonHandler(this.user, this.data, value);
    if (result) {
      if (this.data.state < this.actions.length - 1) {
        await this.data.increment('state');
        await this.data.reload();
      }
    } else if (errorText) {
      this.errorText = errorText;
      setTimeout(async () => {
        this.errorText = null;
        await this.updateMessage(ctx);
      }, constants.error_visible_duration * 1000);
    }
    return result;
  }

  async text() {
    if (this.closed) {
      return '⌛';
    } else if (
      this.activeAction.text &&
      typeof this.activeAction.text === 'function'
    ) {
      return await this.activeAction.text(this.data);
    } else {
      return `${this.titleText}\n\n` +
        this.actions.map((action, i) => {
          return `${action.itemText}: ` +
            (i < this.data.state || this.finished
              ? `*${action.itemStringify(this.data)}*`
              : '...');
        }).join('\n');
    }
  }

  async replyMarkup() {
    if (!this.closed && !(this.activeAction instanceof BaseMessage)) {
      return await this.activeAction.replyMarkup(this.user, this.data, this.data.state);
    } else {
      return null;
    }
  }

  get parseMode() {
    return this.activeAction?.parseMode || 'Markdown';
  }

  async reply(ctx) {
    await this.allocateDataIfNecessary(ctx, async _ => {
      let msg = await ctx.reply(
        await this.text(), {
          parse_mode: this.parseMode,
          protect_content: this.protectContent,
          ...(await this.replyMarkup())
        });

      this.message = await Message.create({
        id: msg.message_id,
        user_id: this.user.id
      });
      await this.data.update({
        message_id: this.message.id
      });
    });
  }

  async updateMessage(ctx) {
    try {
      let cb = async () => {
        await ctx.telegram.editMessageText(
          this.user.chat_id,
          this.data.message_id,
          null,
          await this.text(), {
            parse_mode: this.parseMode,
            ...(await this.replyMarkup())
          });
      }
      if (this.finished) {
        await cb();
      } else {
        await this.allocateDataIfNecessary(ctx, cb)
      }
    } catch(e) {
      // Bad Request: message is not modified...
      if (! (e.response && e.response.error_code === 400)) {
        console.error(e);
      }
    }
  }

  async close(reason, telegram) {
    if (reason === constants.MESSAGE_IS_NOT_RELEVANT) {
      this.closed = true;
    }
    try {
      await telegram.editMessageText(
        this.user.chat_id,
        this.data.message_id,
        null,
        await this.text(), {
          parse_mode: this.parseMode
        });
    } catch (e) {
      // Bad Request: message is not modified...
      if (! (e.response && e.response.error_code === 400)) {
        console.error(e);
      }
    }
  }
}

module.exports = {
  BaseMessage, BaseAction, BaseForm
}
