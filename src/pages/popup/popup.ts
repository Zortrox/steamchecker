import './popup.css';

import { TabMessage, type TabResponse } from '../../types/messages';
import type { SteamIDSettings } from '../../types/steamid-settings';

(() => {
  function saveSteamID() {
    let steamID = document.querySelector<HTMLInputElement>('#steamid')?.value;
    let isID64 = document.querySelector<HTMLInputElement>('#id64')?.checked;

    if (!steamID || isID64 == null) {
      return;
    }

    let steamIDSettings: SteamIDSettings = {
      steamid: steamID,
      id64: isID64,
    };

    storageType.set(steamIDSettings, () => {
      console.log('Saved SteamID: ' + steamIDSettings.steamid);
      console.log('SteamID64: ' + steamIDSettings.id64);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let currentTabID = tabs[0]?.id;
        if (currentTabID == null) {
          return;
        }

        // FIXME: Doesn't run this unless the active tab has the content script loaded?
        chrome.tabs.sendMessage(
          currentTabID,
          { message: TabMessage.REMOVE_GAME_DATA },
          function (response?: TabResponse) {
            if (!response) return;

            console.log(response.message);
          }
        );
      });

      let saveMessage =
        document.querySelector<HTMLSpanElement>('#saveMessage span');
      if (!saveMessage) return;

      saveMessage.classList.toggle('fade-out');
      saveMessage.offsetLeft; // trigger reflow
      saveMessage.classList.toggle('fade-out');
    });
  }

  let storageType = chrome.storage.local;

  if (typeof chrome.storage.sync !== 'undefined') {
    storageType = chrome.storage.sync;
  }

  document.querySelector('#saveButton')?.addEventListener('click', () => {
    saveSteamID();
  });

  storageType.get(['steamid', 'id64'], (obj) => {
    if (!obj) {
      return;
    }

    if (obj['steamid']) {
      let inputSteamID = document.querySelector<HTMLInputElement>('#steamid');
      if (inputSteamID) {
        inputSteamID.value = obj['steamid'];
      }
    }
    if (obj['id64']) {
      let inputID64 = document.querySelector<HTMLInputElement>('#id64');
      if (inputID64) {
        inputID64.checked = true;
      }
    }
  });

  let manifest = chrome.runtime.getManifest();
  let elemVersion = document.querySelector('#version');
  if (elemVersion) {
    elemVersion.textContent = `Version: ${manifest.version}`;
  }
})();
