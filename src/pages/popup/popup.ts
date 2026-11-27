import "./popup.css";

import type { FoxslashAccount } from "../../lib/auth";
import { TabMessage, sendToBackground } from "../../types/messages";

const $ = <T extends HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

const signedOut = $("#signed-out");
const signedIn = $("#signed-in");
const signInButton = $<HTMLButtonElement>("#signInButton");
const statusMessage = $("#status-message");

function showStatus(text: string) {
  statusMessage.textContent = text;
}

function render(account: FoxslashAccount | null) {
  signedOut.hidden = account !== null;
  signedIn.hidden = account === null;
  if (!account) return;

  $("#account-name").textContent = account.name;
  $("#account-steam").textContent = account.steam_name
    ? `Steam: ${account.steam_name}`
    : account.steam_id
      ? `Steam ID ${account.steam_id}`
      : "No Steam account linked on foxslash";

  const avatar = $<HTMLImageElement>("#account-avatar");
  avatar.hidden = !account.avatar_url;
  if (account.avatar_url) avatar.src = account.avatar_url;
}

/** Drop cached game names and page config in the Humble tab, then reload it. */
async function refreshActiveTab(): Promise<boolean> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, { message: TabMessage.REMOVE_GAME_DATA });
  } catch {
    return false; // not a Humble tab
  }
  await chrome.tabs.reload(tab.id);
  return true;
}

signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  showStatus("Finish signing in in the foxslash window...");

  // In Chrome the popup may close while the sign-in window is open. The
  // background script finishes the sign-in either way.
  const result = await sendToBackground({ type: "signIn" });
  signInButton.disabled = false;

  if (result.ok) {
    render(result.account);
    showStatus("Signed in. Humble tabs reload with your games.");
  } else {
    showStatus(result.error);
  }
});

$("#signOutButton").addEventListener("click", async () => {
  await sendToBackground({ type: "signOut" });
  render(null);
  showStatus("Signed out.");
});

$("#refreshButton").addEventListener("click", async () => {
  const refreshed = await refreshActiveTab();
  showStatus(refreshed ? "Reloading with fresh data..." : "Open a Humble Bundle tab first.");
});

$("#version span").textContent = chrome.runtime.getManifest().version;

sendToBackground({ type: "getAccount" }).then(({ account }) => render(account));
