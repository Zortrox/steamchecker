<?php

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

function get_data($url) {
	$ch = curl_init();
	$timeout = 10;
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
	curl_setopt($ch, CURLOPT_HTTPGET, 1);
	curl_setopt($ch, CURLOPT_HEADER, 0);
	curl_setopt($ch, CURLOPT_USERAGENT, sprintf("Mozilla/%d.0",rand(4,5)));
	$data = curl_exec($ch);
	curl_close($ch);
	return $data;
}

function requireToVar($file){
    ob_start();
    require($file);
    return ob_get_clean();
}

function jsonMessage($msg) {
	if (isset($_GET['callback']))
		echo $_GET['callback'] . "({\"message\": \n" . json_encode($msg, JSON_PRETTY_PRINT) . "\n})";
	else
		echo "{\"message\": \n" . json_encode($msg, JSON_PRETTY_PRINT) . "\n}";
}

if (isset($_GET['steamid'])) {
	header('Content-Type: application/json;charset=utf-8');
	header("Access-Control-Allow-Origin: *");
	$APIkey = "B4FB690143E90D406DF3392540297A2A";
	$command = "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" . $APIkey . "&include_appinfo=1&steamid=";

	$messages = [];
	$timeArray = new stdClass();

	$steamid = $_GET['steamid'];
	if (!isset($_GET['id64']) || $_GET['id64'] == "0") {
		try {
			$startTime = microtime(true);
			$steamXML = new SimpleXMLElement(get_data("http://steamcommunity.com/id/" . $steamid . "/?xml=1"));
			$timeArray->steamID64 = round((microtime(true)-$startTime) * 1000);
			if ($steamXML->error == "") {
				$steamid = $steamXML->steamID64;
			} else {
				array_push($messages, (string)$steamXML->error);
				$steamid = "";
			}
		} catch (Exception $e) {
			array_push($messages, "Steam profile unable to be parsed.");
			$steamid = "";
		}
	}

	$opts = array('http' => array('ignore_errors' => true));
	$context = stream_context_create($opts);
	$startTime = microtime(true);
	$gamesData = json_decode(get_data($command . $steamid, false, $context));
	$timeArray->gameInfo = round((microtime(true)-$startTime) * 1000);

	if ($gamesData) {
		//$startTime = microtime(true);
		//$wishlistArray = json_decode( requireToVar("https://foxslash.com/apps/steamchecker/wishlist.php?url=http://steamcommunity.com/profiles/" . $steamid) );
		//$timeArray->wishlistInfo = round((microtime(true)-$startTime) * 1000);

		//if (property_exists($wishlistArray, "wishlist")) $gamesData->wishlist = $wishlistArray->wishlist;
		//$startTime = microtime(true);
		//$aliasArray = json_decode( file_get_contents("https://foxslash.com/apps/steamchecker/aliases.json") );
		//$timeArray->aliasInfo = round((microtime(true)-$startTime) * 1000);
		//$gamesData->aliases = $aliasArray->aliases;
		$gamesData->aliases = new stdClass();	//for older versions of the extension

		if (isset($_GET['time']) && $_GET['time'] == "1") {
			$gamesData->times = $timeArray;
		}

		if (isset($_GET['callback'])) {
			echo $_GET['callback'] . "(";
			echo json_encode($gamesData, JSON_PRETTY_PRINT);
			echo ")";
		} else {
			echo json_encode($gamesData, JSON_PRETTY_PRINT);
		}
	} else {
		array_push($messages, "No game data for profile.");
	}

	if (count($messages) > 0) {
		jsonMessage($messages);
	}
} else {
	//render website
	include_once("site.php");
}

?>