
const state = {
  currentHref: '',
  observedElem: null,
  busy: false,
  listeners: [],
};
const TARGET_PAGE_URL = 'https://growfood.pro/dashboard/orders/all';
const EXTENSION_ID = 'copy-gf-menu-ce';
const CCAL_TR = 'Ккал';
const LINE_PREFIX = '- '

const findElem = (selector) => new Promise((resolve) => {
  const bodyElem = document.querySelector('body');
  let requiredElem = null;
  const callback = function(mutationsList, observer) {
    requiredElem = bodyElem.querySelector(selector);
    if (requiredElem) {
      observer.disconnect();
      resolve(requiredElem);
    }
  }

  const observer = new MutationObserver(callback);
  observer.observe(bodyElem, { attributes: false, childList: true, subtree: true });
});

const listenOnElemDomChanged = (elem, callback) => {
  const listenerState = {
    observer: null,
  }

  listenerState.observer = new MutationObserver(callback);
  listenerState.observer.observe(elem, { attributes: false, childList: true, subtree: true });

  state.listeners.push(listenerState);
};

const listenOnUrlChanged = (callback) => {
  setInterval(() => {
    const { href } = window.location;
    if (href !== state.currentHref) {
      callback(href);
    }
  }, 100)
};

const resetState = () => {
  state.observedElem = null;
  state.listeners.forEach(({ observer }) => {
    observer.disconnect();
  });
  state.listeners = [];
  console.log('[S] reset all');
};

const collectMenuDishData = (menuEatingElem) => {
  const menuDishElems = menuEatingElem.querySelectorAll('.menu-dish');
  if (!menuDishElems) {
    console.error(`${EXTENSION_ID}: parsing error! menuDishElems not found`)
    return [];
  }

  return [].reduce.call(menuDishElems, (acc, menuDishElem) => {
    const titleText = menuDishElem.querySelector('.title').innerHTML;
    const ccalText = menuDishElem.querySelector('.metric').innerHTML;

    if (!titleText || !ccalText) {
      console.error(`${EXTENSION_ID}: parsing error! impossible to parse menuDishElem`)
      return acc;
    }

    const title = titleText.replace(/&nbsp;/, ' ');
    const ccal = ccalText.replace(/ <span.*/, '');

    return [ ...acc, { title, ccal }];
  }, []);
};

const parseData = (daysContainer) => {
  const menuEatingElems = daysContainer.querySelectorAll('.menu-eating');
  if (!menuEatingElems) {
    console.error(`${EXTENSION_ID}: parsing error! menuEatingElems not found`);
    return;
  }

  return [].reduce.call(menuEatingElems,(acc, menuEatingElem) => ([
    ...acc,
    collectMenuDishData(menuEatingElem),
  ]), []);
};

const getDishString = ({ title, ccal }) => `${title} (${ccal} ${CCAL_TR})`;

const buildMarkdown = (parsedData) => {
  const menuText = parsedData
    .reduce((acc, pack) => {
      if (!pack.length) { return acc }

      const line = pack.reduce((lineAcc, dish, index) => {
        return (index === pack.length - 1)
          ? `${lineAcc}${getDishString(dish)}`
          : `${lineAcc}${getDishString(dish)} + `
      }, '');

      return `${acc}${LINE_PREFIX}${line}\n`;
    }, '');

  const ccalSum = parsedData
    .reduce((acc, pack) => {
      if (!pack.length) { return acc }

      const packText = pack.reduce((packAcc, { ccal }) => `${packAcc}${ccal} + `, '');
      return `${acc}${packText}`;
    }, '')
    .slice(0, -3); // remove last " + " substring

  return `${menuText}\n${ccalSum}`;
};

const onBtnClickHandler = (event) => {
  const daysContainer = event.target.parentElement.parentElement;

  const parsedData = parseData(daysContainer);
  const markdownText = buildMarkdown(parsedData);
  console.log('>>>\n', markdownText);

  navigator.clipboard.writeText(markdownText).catch(() => {
    console.error(`${EXTENSION_ID}: clipboard write text error`, error);
  });
};

const addButton = (parentNode) => {
    const button = document.createElement('button');
    button.setAttribute('class', 'cgfmenuce-btn');
    button.innerHTML = 'Copy menu';
    button.addEventListener('click', onBtnClickHandler);
    parentNode.appendChild(button);
};

const main = async (href) => {
  state.currentHref = href;

  if (!state.currentHref.includes(TARGET_PAGE_URL)) {
    resetState();
    return;
  }
  state.observedElem = await findElem('#client-orders');

  listenOnElemDomChanged(state.observedElem, (mutationsList) => {
    const menuDays = state.observedElem.querySelector('.menu-days');

    if (!menuDays || menuDays.GFmodified) {
      return;
    }

    addButton(menuDays);
    menuDays.GFmodified = true;
  });
};
listenOnUrlChanged(main);




