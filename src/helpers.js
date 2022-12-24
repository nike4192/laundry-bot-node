
const cron = require("node-cron");

function createDaysProxy(target, handler = {}) {
  let proxy = new Proxy(target, handler);

  function update() {
    let roundedNow = new Date();
    roundedNow.setHours(0, 0, 0, 0);
    if (typeof target === 'object') {
      if (Array.isArray(target)) {
        // Array
        if (target.length) {
          let i = 0;
          while (i < target.length) {
            let v = target[i];
            if (v >= roundedNow) i++;
            else target.splice(i, 1);
          }
        }
      } else {
        // Object
        let keys = Object.keys(target);
        if (keys.length) {
          for (let key of keys) {
            if (new Date(key) < roundedNow) {
              delete target[key];
            }
          }
        }
      }
    }
  }

  update();
  cron.schedule('0 0 * * *', update);

  return proxy;
}

module.exports = {
  createDaysProxy
}
