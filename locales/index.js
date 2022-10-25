
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

function loadLocale(languageCode) {
  let filepath = path.join(__dirname, languageCode + '.yml');
  return yaml.load(fs.readFileSync(filepath, 'utf-8'));
}

module.exports = {
  ru: loadLocale('ru'),
  en: loadLocale('en')
}
