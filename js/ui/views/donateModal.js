/**
 * Donate dialog: WeChat / Alipay appreciation QR codes.
 * Images live in docs/donate/; if missing (e.g. dev clone without assets),
 * the card degrades to a friendly placeholder instead of a broken image.
 */
import { h } from '../dom.js';
import { openModal, closeModal } from '../components/modal.js';

function qrCard(title, src, fallbackText) {
  // The composed image already carries a platform-colored label banner,
  // so no extra title row is rendered here.
  const img = h('img', {
    src, alt: `${title}赞赏码`, class: 'donate-qr',
    onerror: () => { img.replaceWith(h('div', { class: 'donate-qr donate-missing' }, fallbackText)); },
  });
  return h('div', { class: 'donate-card' }, img);
}

export function openDonateModal() {
  const modal = openModal({
    title: '☕ 赞赏支持',
    width: 460,
    content: h('div', {},
      h('div', { class: 'donate-note' },
        '智能排座永久免费。如果它帮你省下了一节晚自习的时间，',
        h('br'),
        '一杯咖啡就是对作者最好的鼓励 ☕'),
      h('div', { class: 'donate-row' },
        qrCard('微信赞赏', 'docs/donate/donate-wechat.png', '微信赞赏码（待补充图片）'),
        qrCard('支付宝赞赏', 'docs/donate/donate-alipay.png', '支付宝赞赏码（待补充图片）'))),
    footer: [h('button', { class: 'btn', onclick: () => closeModal(modal) }, '关闭')],
  });
  return modal;
}
