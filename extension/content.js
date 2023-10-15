// content.js

prevTime = 0;
thisURL = window.location.pathname;
storageType = chrome.storage.local;

//arrays for games currently on humble bundle
var webNames = [];
var machineNames = [];
var htmlElements = [];

//arrays for game names + aliases
var ownedNames = [];
var wishedNames = [];

//custom attribute that has the game name
gamenameAttr = "data-slideout";
gameHightlightBox = "";

var HighlightMode = Object.freeze({
	BUNDLE: 0,
	KEYS: 1,
	STORE: 2,
	SEARCH: 3,
	CHOICE: 4
});
var currentMode = 0;

var timeoutKeysTable;
function mutationFunction() {
	var that = this;

	var targetNode = function(parentNode) {
		return $(parentNode)[0];
	};
	var config = { subtree: true, childList: true };
	var callback = function(mutationsList) {
		for(var index in mutationsList) {
			if (mutationsList[index].type == 'childList' && mutationsList[index].target.nodeName.toLowerCase() != "i") {
				nodeAdded();
			}
		}
	};

	var observer = new MutationObserver(callback);

	function waitForAddedNode(parentNode) {
		var el = targetNode(parentNode);
		if (el) {
			nodeAdded();
			observer.observe(el, config);
		} else {
			new MutationObserver(function(mutations) {
				el = targetNode(parentNode);
				if (el) {
					this.disconnect();
					observer.observe(el, config);
				}
			}).observe(document, {
				subtree: true,
				childList: true,
			});
		}
	}

	function nodeAdded() {
		var waitTime = 100;

		clearTimeout(timeoutKeysTable);

		timeoutKeysTable = setTimeout(function() {
			processWebpageData();
			highlightGames();
		}, waitTime);
	}

	that.observe = function(parentNode) {
		waitForAddedNode(parentNode);
	};
	that.disconnect = function() {
		observer.disconnect();
	};
}
var mutationKeysTable = new mutationFunction();

function extConsoleOut(msg) {
	if (typeof msg !== "object") {
		console.log("Steam Library Checker: " + msg);
	} else {
		console.log("Steam Library Checker:");
		console.log(msg);
	}
}

function loadAliases(steamArray, aliasArray, doWishlist) {
	var addNames = [];

	if (doWishlist) {
		$.each(Object.keys(aliasArray), function(i, appid) {
			$.each(Object.keys(steamArray), function(j, wishid) {
				if (appid == wishid){
					$.merge(addNames, aliasArray[appid]);
					return false;
				}
			});
		});
	} else {
		$.each(Object.keys(aliasArray), function(i, appid) {
			$.each(steamArray, function(j, game) {
				if (appid == game.appid){
					$.merge(addNames, aliasArray[appid]);
					return false;
				}
			});
		});
	}

	extConsoleOut("Aliases loaded");
	extConsoleOut(addNames);

	return addNames;
}

function processJSON(data) {
	extConsoleOut("Loaded all data.");
	extConsoleOut(data);

	prevTime = Date.now();

	//load aliases
	var newNames = loadAliases(data.response.games, data.aliases, false);

	//load wishlist aliases
	$.each(data.wishlist, function(i, appid) {
		$.each(data.applist, function(j, app) {
			if (app.appid == appid) {
				wishedNames.push(app.name.toLowerCase().replace(/[\W_]/g, ''));
				return false;
			}
		});
	});
	var wishAliasNames = (data.wishlist)?loadAliases(data.wishlist, data.aliases, true):[];
	
	extConsoleOut("(TIME) Alias Loading: " + (Date.now() - prevTime) + "ms");

	var numGames = 0;
	chrome.storage.local.get("numgames", function(number) {
		if (typeof number.numgames !== "undefined") numGames = number.numgames;

		if (numGames < data.response.game_count) {
			$.each(data.response.games, function(i, game) {
				//remove everything except alphanumeric
				ownedNames.push(game.name.toLowerCase().replace(/[\W_]/g, ''));
			});

			chrome.storage.local.set({ "shortnames": ownedNames, "numgames": data.response.game_count, "aliases": newNames}, function() {
				extConsoleOut("Saved " + data.response.game_count + " game names");

				if (newNames.length > 0) $.merge(ownedNames, newNames);
				if (wishedNames.length > 0 && wishAliasNames.length > 0) $.merge(wishedNames, wishAliasNames);

				highlightGames(ownedNames, wishedNames);
			});

		} else {
			chrome.storage.local.get(["shortnames", "aliases"], function(nameArray) {
				extConsoleOut("Game names loaded");
				ownedNames = nameArray.shortnames;

				if (newNames.length > 0)  $.merge(ownedNames, newNames);
				if (wishedNames.length > 0 && wishAliasNames.length > 0) $.merge(wishedNames, wishAliasNames);

				highlightGames(ownedNames, wishedNames);
			});
		}
	});
}

function addClassToElements(webName, webIndex, gameName, addedClass) {
	if (webName == gameName) {
		if (currentMode == HighlightMode.BUNDLE) {
			$("[" + gamenameAttr + "='" + machineNames[webIndex] + "']").closest(".dd-image-box").addClass(addedClass);
		} else if (currentMode == HighlightMode.KEYS) {
			var keyElement = $("td.game-name h4[title='" + machineNames[webIndex] + "']").closest("tr");
			if (addedClass == "ownedGame") {
				keyElement.addClass("ownedKey");
				keyElement.find(".hb-gift").append("<img src=\"" + chrome.extension.getURL('star.png') + "\" class=\"star\"/>");
			} else {
				keyElement.addClass("wishedKey");
			}
		} else if (currentMode == HighlightMode.STORE || currentMode == HighlightMode.SEARCH) {
			$(".entity-block-container").filter( function() {
				return $(".entity-title", this).text() == machineNames[webIndex];
			}).addClass(addedClass);
			$(".entity-container .entity-title[title='" + machineNames[webIndex] + "']").closest(".entity-container").addClass(addedClass);
		} else if (currentMode == HighlightMode.CHOICE) {
			$(".content-choice").filter( function() {
				return $(".content-choice-title", this).text() == machineNames[webIndex];
			}).addClass(addedClass);
		}
	}
}

//show owned and wishlisted games
function highlightGames() {
	prevTime = Date.now();

	//check if names are the same
	$.each(ownedNames, function(i, steamName) {
		$.each(webNames, function(webIndex, webName) {
			addClassToElements(webName, webIndex, steamName, "ownedGame");
		});
	});

	//check if in wishlist
	$.each(wishedNames, function(i, wishName) {
		$.each(webNames, function(webIndex, webName) {
			addClassToElements(webName, webIndex, wishName, "wishedGame");
		});
	});

	extConsoleOut("(TIME) Game Checking: " + (Date.now() - prevTime) + "ms");
}

function processWebpageData() {
	webNames = [];
	machineNames = [];

	if (currentMode == HighlightMode.BUNDLE) {
		//get the Humble Bundle game machine names
		$(".dd-image-box-figure[" + gamenameAttr + "]").each(function() {
		//$(".dd-image-box-caption").each(function() {
			var title = $( this ).attr(gamenameAttr);
			//var title = $(this).text();

			if (title != "") {
				machineNames.push(title.replace(/(["'])/, "\\$1"));
				webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
				htmlElements.push($(this).closest(".dd-image-box"));
			}
		});
	} else if (currentMode == HighlightMode.KEYS) {
		$(".unredeemed-keys-table tr .game-name h4").each(function() {
			var title = $( this ).attr("title");

			if (title != "") {
				machineNames.push(title.replace(/(["'])/, "\\$1"));
				webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
			}
		});
	} else if (currentMode == HighlightMode.STORE || currentMode == HighlightMode.SEARCH) {
		$(".entity-block-container .entity-title, .entity-container .entity-title").each(function() {
			var title = $( this ).attr("title");
			if (!title || title == "") {
				title = $( this ).text();
			}

			if (title != "") {
				machineNames.push(title.replace(/(["'])/, "\\$1"));
				webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
				htmlElements.push($(this).closest(".entity-block-container, .entity-container"));
			}
		});
	} else if (currentMode == HighlightMode.CHOICE) {
		$(".content-choice .content-choice-title").each(function() {
			var title = $( this ).text();

			if (title != "") {
				machineNames.push(title.replace(/(["'])/, "\\$1"));
				webNames.push(title.toLowerCase().replace(/[\W_]/g, ''));
				htmlElements.push($(this).closest(".content-choice"));
			}
		});
	} else {
		extConsoleOut("Not yet scanning on this URL");
	}
}

function start() {
	if (typeof(chrome.storage.sync) != "undefined") {
		storageType = chrome.storage.sync;
	}
	storageType.get(["steamid", "id64"], function (obj) {
		if(obj.steamid) {
			var id64 = "";
			var wishlistTag = "";
			if (obj.id64){
				id64 = "&id64";
				wishlistTag = "id64";
			} else {
				wishlistTag = "id";
			}

			//GET WEB GAME DATA
			if (currentMode == HighlightMode.KEYS) {
				mutationKeysTable.observe(".unredeemed-keys-table");
			} else if (currentMode == HighlightMode.SEARCH) {
				mutationKeysTable.observe(".list-content");
			} else {
				processWebpageData();
			}

			prevTime = Date.now();
			var totalData = {};
			var defGames = $.Deferred();
			var defAliases = $.Deferred();
			var defWishlist = $.Deferred();
			var defAppList = $.Deferred();

			var xhrGames = new XMLHttpRequest();
			xhrGames.open("GET", "https://www.foxslash.com/apps/steamchecker/?steamid=" + obj.steamid + id64, true);
			xhrGames.onreadystatechange = function() {
				if (xhrGames.readyState == 4) {
					var data = JSON.parse(xhrGames.responseText);

					if (!data.message) {
						extConsoleOut("(TIME) Steam Games: " + (Date.now() - prevTime) + "ms");
							$.each(data.message, function(i, elem) {
								extConsoleOut(elem.toString());
							});
							if (data.response) {
								totalData.response = data.response;
							}
					} else {
						extConsoleOut(data.message);
					}

					defGames.resolve();
				}
			};
			xhrGames.send();

			var xhrWishlist = new XMLHttpRequest();
			xhrWishlist.open("GET", "https://www.foxslash.com/apps/steamchecker/wishlist.php?type=" + wishlistTag + "&id=" + obj.steamid, true);
			xhrWishlist.onreadystatechange = function() {
				if (xhrWishlist.readyState == 4) {
					var data = JSON.parse(xhrWishlist.responseText);

					if (!data.message) {
						extConsoleOut("(TIME) Steam Wishlist: " + (Date.now() - prevTime) + "ms");
						totalData.wishlist = data.wishlist;
					} else {
						extConsoleOut(data.message);
					}

					defWishlist.resolve();
				}
			};
			xhrWishlist.send();

			//get php arguments of game names
			var phpArgs = {};
			if (currentMode == HighlightMode.KEYS) {
				phpArgs.type = "all";
			} else {
				phpArgs.type = "some";
				phpArgs.names = [];
				$.each(webNames, function(i, name) {
					phpArgs.names.push(name);
				});
			}

			var xhrAliases = new XMLHttpRequest();
			xhrAliases.open("POST", "https://www.foxslash.com/apps/steamchecker/aliases.php", true);
			xhrAliases.onreadystatechange = function() {
				if (xhrAliases.readyState == 4) {
					var data = JSON.parse(xhrAliases.responseText);

					if (!data.message) {
						extConsoleOut("(TIME) Steam Aliases: " + (Date.now() - prevTime) + "ms");
						totalData.aliases = data;
					} else {
						extConsoleOut(data.message);
					}

					defAliases.resolve();

					successAliases = true;
				}
			};
			xhrAliases.send( JSON.stringify(phpArgs) );

			var xhrAppList = new XMLHttpRequest();
			xhrAppList.open("GET", "https://www.foxslash.com/apps/steamchecker/appList.json", true);
			xhrAppList.onreadystatechange = function() {
				if (xhrAppList.readyState == 4) {
					var data = JSON.parse(xhrAppList.responseText);

					if (!data.message) {
						extConsoleOut("(TIME) Steam App List: " + (Date.now() - prevTime) + "ms");
						totalData.applist = data.applist.apps;
					} else {
						extConsoleOut(data.message);
					}

					defAppList.resolve();

					successAliases = true;
				}
			};
			xhrAppList.send();

			$.when(
				defGames,
				defAliases,
				defWishlist,
				defAppList
			).then(function() {
				processJSON(totalData);
			});
		} else {
			extConsoleOut("No SteamID Saved");
		}
	});

	chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
		if (request.message == "removeGameData") {
			chrome.storage.local.remove(["shortnames", "numgames", "aliases"], function() {
				extConsoleOut("Game data removed.");
			});
			sendResponse({message: "Game data removed"});
		}
	});
}

$(function() {
	if (thisURL.substr(0, 6) != "/books" && thisURL.substr(0, 9) != "/monthly") {
		if (thisURL == "/home/keys") currentMode = HighlightMode.KEYS;
		else if (thisURL == "/store") currentMode = HighlightMode.STORE;
		else if (thisURL == "/store/search") currentMode = HighlightMode.SEARCH;
		else if (thisURL == "/subscription/home") currentMode = HighlightMode.CHOICE;

		start();
	} else {
		extConsoleOut("Not yet scanning on this URL");
	}
});