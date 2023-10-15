storageType = chrome.storage.local;

$(document).ready(function() {
	if (typeof(chrome.storage.sync) != "undefined") {
		storageType = chrome.storage.sync;
	}

	$("#saveButton").click(function() {
		saveSteamID();
	})

	storageType.get(["steamid", "id64"], function (obj) {
		if (obj) {
			if(obj.steamid) {
				$("#steamid").val(obj.steamid);
			}
			if(obj.id64) {
				$("#id64").prop('checked', true);
			}
		}
	});

	var manifest = chrome.runtime.getManifest();
	$("#version").text("Version: " + manifest.version);
})

function saveSteamID() {
	var steamIDSettings = {
		"steamid": $("#steamid").val(),
		"id64": $("#id64").is(":checked")
	}

	storageType.set(steamIDSettings, function() {
		console.log("Saved SteamID: " + steamIDSettings.steamid);
		console.log("SteamID64: " + steamIDSettings.id64);

		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			chrome.tabs.sendMessage(tabs[0].id, {message: "removeGameData"}, function(response) {
				if (response) {
					console.log(response.message);
				}
			});
		});

		$("#saveMessage span").css("opacity", 1);
		$("#saveMessage span").stop().animate({
			"opacity": 0
		}, 1500);
	});
}