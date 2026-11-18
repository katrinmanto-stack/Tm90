/* روش «ثبت درخواست خرید» برای چک‌اوت بلوکی ووکامرس */
(function () {
  var w = window;
  if (!w.wc || !w.wc.wcBlocksRegistry || !w.wc.wcSettings || !w.wp || !w.wp.element) return;
  var el = w.wp.element.createElement;
  var dec = w.wp.htmlEntities && w.wp.htmlEntities.decodeEntities ? w.wp.htmlEntities.decodeEntities : function (s) { return s; };
  var d = w.wc.wcSettings.getSetting('bazar_request_data', {});
  var title = dec(d.title || 'ثبت درخواست خرید');
  var text = dec(d.description || '');

  function Label(props) {
    var C = props.components && props.components.PaymentMethodLabel;
    return C ? el(C, { text: title }) : el('span', null, title);
  }
  function Content() { return el('div', null, text); }

  w.wc.wcBlocksRegistry.registerPaymentMethod({
    name: 'bazar_request',
    label: el(Label, null),
    content: el(Content, null),
    edit: el(Content, null),
    canMakePayment: function () { return true; },
    ariaLabel: title,
    supports: { features: d.supports || ['products'] }
  });
})();
