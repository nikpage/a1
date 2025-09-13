// i18n.js
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import indexPageEn from './locales/en/indexPage.json'
import pricingEn from './locales/en/pricing.json'
import simpleStepsEn from './locales/en/simpleSteps.json'
import secretWeaponEn from './locales/en/secretWeapon.json'
import loginEn from './locales/en/login.json'
import analysisDisplayEn from './locales/en/analysisDisplay.json'
import startFreshHeaderEn from './locales/en/startFreshHeader.json'
import startFreshModalEn from './locales/en/startFreshModal.json'
import startFreshSelectorEn from './locales/en/startFreshSelector.json'
import startFreshUploadModalEn from './locales/en/startFreshUploadModal.json'
import tabbedViewerEn from './locales/en/tabbedViewer.json'
import thankYouModalEn from './locales/en/thankYouModal.json'
import tokenCounterEn from './locales/en/tokenCounter.json'
import tokenPurchasePanelEn from './locales/en/tokenPurchasePanel.json'
import toneDocModalEn from './locales/en/toneDocModal.json'
import headerEn from './locales/en/header.json'

import indexPageCs from './locales/cs/indexPage.json'
import pricingCs from './locales/cs/pricing.json'
import simpleStepsCs from './locales/cs/simpleSteps.json'
import secretWeaponCs from './locales/cs/secretWeapon.json'
import loginCs from './locales/cs/login.json'
import analysisDisplayCs from './locales/cs/analysisDisplay.json'
import startFreshHeaderCs from './locales/cs/startFreshHeader.json'
import startFreshModalCs from './locales/cs/startFreshModal.json'
import startFreshSelectorCs from './locales/cs/startFreshSelector.json'
import startFreshUploadModalCs from './locales/cs/startFreshUploadModal.json'
import tabbedViewerCs from './locales/cs/tabbedViewer.json'
import thankYouModalCs from './locales/cs/thankYouModal.json'
import tokenCounterCs from './locales/cs/tokenCounter.json'
import tokenPurchasePanelCs from './locales/cs/tokenPurchasePanel.json'
import toneDocModalCs from './locales/cs/toneDocModal.json'
import headerCs from './locales/cs/header.json'

i18n.use(initReactI18next).init({
  resources: {
    en: {
      indexPage: indexPageEn,
      pricing: pricingEn,
      simpleSteps: simpleStepsEn,
      secretWeapon: secretWeaponEn,
      login: loginEn,
      analysisDisplay: analysisDisplayEn,
      startFreshHeader: startFreshHeaderEn,
      startFreshModal: startFreshModalEn,
      startFreshSelector: startFreshSelectorEn,
      startFreshUploadModal: startFreshUploadModalEn,
      tabbedViewer: tabbedViewerEn,
      thankYouModal: thankYouModalEn,
      tokenCounter: tokenCounterEn,
      tokenPurchasePanel: tokenPurchasePanelEn,
      toneDocModal: toneDocModalEn,
      header: headerEn,
    },
    cs: {
      indexPage: indexPageCs,
      pricing: pricingCs,
      simpleSteps: simpleStepsCs,
      secretWeapon: secretWeaponCs,
      login: loginCs,
      analysisDisplay: analysisDisplayCs,
      startFreshHeader: startFreshHeaderCs,
      startFreshModal: startFreshModalCs,
      startFreshSelector: startFreshSelectorCs,
      startFreshUploadModal: startFreshUploadModalCs,
      tabbedViewer: tabbedViewerCs,
      thankYouModal: thankYouModalCs,
      tokenCounter: tokenCounterCs,
      tokenPurchasePanel: tokenPurchasePanelCs,
      toneDocModal: toneDocModalCs,
      header: headerCs,
    },
  },

  lng: undefined,
  fallbackLng: 'en',
  supportedLngs: ['en', 'cs'],
  ns: [
    'indexPage',
    'pricing',
    'simpleSteps',
    'secretWeapon',
    'login',
    'analysisDisplay',
    'startFreshHeader',
    'startFreshModal',
    'startFreshSelector',
    'startFreshUploadModal',
    'tabbedViewer',
    'thankYouModal',
    'tokenCounter',
    'tokenPurchasePanel',
    'toneDocModal',
    'header',
  ],
  defaultNS: 'indexPage',
  interpolation: { escapeValue: false },
})

export default i18n
