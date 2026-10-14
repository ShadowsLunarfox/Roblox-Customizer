(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const documentType = params.get('document') === 'terms' ? 'terms' : 'privacy';
  const requestedLanguage = params.get('lang');
  let language = ['en', 'zh-CN', 'zh-TW'].includes(requestedLanguage) ? requestedLanguage : 'en';
  const select = document.getElementById('language');
  select.value = language;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function render(data) {
    const locale = data.locales[language];
    const policy = locale[documentType];
    document.documentElement.lang = language;
    document.title = `${policy.title} — Roblox Customizer`;
    document.querySelector('label[for="language"]').textContent = locale.languageLabel;
    document.querySelector('nav').setAttribute('aria-label', locale.navigationLabel);
    for (const type of ['terms', 'privacy']) {
      const link = document.getElementById(`${type}-link`);
      link.textContent = locale[type].title;
      link.href = `?document=${type}&lang=${language}`;
      if (type === documentType) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const content = document.getElementById('legal-content');
    const heading = node('h1', policy.title);
    heading.id = 'document-title';
    const metadata = node('div', '', 'metadata');
    metadata.append(node('span', `${locale.updatedLabel}: ${data.updated}`), node('span', `${locale.publisherLabel}: ${data.publisher}`));
    content.replaceChildren(heading, metadata, node('p', policy.intro));
    for (const block of policy.sections) {
      const section = node('section', '');
      section.append(node('h2', block.heading));
      for (const text of block.paragraphs || []) section.append(node('p', text));
      if (block.items) {
        const list = node('ul', '');
        for (const text of block.items) list.append(node('li', text));
        section.append(list);
      }
      content.append(section);
    }
    const contact = node('section', '', 'contact');
    contact.append(node('h2', locale.contactHeading), node('p', locale.contactText));
    const links = node('div', '', 'contact-links');
    const email = node('a', data.email);
    email.href = `mailto:${data.email}`;
    links.append(email);
    for (const item of data.contacts) {
      const link = node('a', item.label);
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.append(link);
    }
    contact.append(links);
    content.append(contact);
  }

  fetch('content.json').then(response => {
    if (!response.ok) throw new Error('Document unavailable');
    return response.json();
  }).then(data => {
    render(data);
    select.addEventListener('change', () => {
      language = select.value;
      const url = new URL(location.href);
      // Keep only the supported document and language parameters in the address.
      url.search = `?document=${documentType}&lang=${language}`;
      history.replaceState(null, '', url);
      render(data);
    });
  }).catch(() => {
    const messages = {
      en: 'The document could not be loaded. Reload this page or contact lunar@lunarfox.my.',
      'zh-CN': '无法加载文件。请刷新此页面或联系 lunar@lunarfox.my。',
      'zh-TW': '無法載入文件。請重新整理此頁面或聯絡 lunar@lunarfox.my。'
    };
    document.documentElement.lang = language;
    const status = node('p', messages[language]);
    status.setAttribute('role', 'alert');
    const heading = node('h1', 'Roblox Customizer');
    heading.id = 'document-title';
    document.getElementById('legal-content').replaceChildren(heading, status);
    select.disabled = true;
  });
})();
