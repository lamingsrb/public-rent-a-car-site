// ====================================
// common-en.js · EN defaults for the `common.*` keys (there is no common partial; SR lives in i18n/sr/common.json). Brief §9.2, §5.0.5.
// ====================================
// Exports: EN_COMMON  { 'common.price.from': 'from €{n} / day*', ... }
// Read through tr(key) from ./tr.js · never import this directly in a section.
// Placeholders: {n} {car} {pickup} {from} {to} {year}. SR money uses a non-breaking space (U+00A0) between number and €.
export const EN_COMMON = {
  'common.price.from': 'from €{n} / day*',
  'common.price.note': 'Daily starting price. The final price depends on rental period and season. Ask us for a quote.',
  'common.price.noteStar': '* Daily starting price. The final price depends on rental period and season. Ask us for a quote.',
  'common.price.included': 'The daily price includes tax and unlimited mileage, unless a promotional price says otherwise.',
  'common.vat': 'VAT',
  'common.cta.message': 'Message us',
  'common.cta.call': 'Call',
  'common.cta.whatsapp': 'WhatsApp',
  'common.cta.viber': 'Viber',
  'common.cta.telegram': 'Telegram',
  'common.cta.email': 'E-mail',
  'common.cta.fleet': 'See the fleet',
  'common.illustrative': 'Illustrative image',
  'common.illustrativeShort': 'Illustrative',
  'common.msg.subject': 'Rental enquiry',
  'common.msg.copied': 'Message copied. Paste it in the chat.',
  'common.msg.copyTitle': 'Copy this message',
  'common.msg.copyBtn': 'Copy',
  'common.msg.openByHand': 'The app did not open? Copy the message and paste it in the chat.',
  'common.msg.blank': '…',
  'common.msg.general': "Hello Public Rent a Car! I'm interested in renting a car in Belgrade. Could you check availability?",
  'common.msg.car': "Hello! I'm interested in the {car}. Pick-up: {pickup}, from {from} to {to}. Is it available?",
  'common.msg.airport': 'Hello! I need an airport pick-up at Belgrade Nikola Tesla Airport on {from}. Could you confirm availability and the pick-up fee?',
  'common.msg.location': "Hello! I'd like to pick up a car at {pickup}. Could you check availability?",
  'common.msg.terms': 'Hello! I have a question about the deposit and rental conditions.',
  'common.close': 'Close',
  'common.skip': 'Skip to content',
  'common.yes': 'On',
  'common.no': 'Off',
  // helper strings added by the foundation (SR twins in common.json)
  'common.unit.hp': 'hp',
  'common.seats': '{n} seats',
  'common.copyNumber': 'Number: {tel}',
  'common.copyDone': 'Copied',
}
