<?php

if (isset($_GET['url'])) {
	$url = $_GET['url'];
	if (substr($url, -1) == "/") $url = substr($url, 0, strlen($url) - 1);
	$url = $url . "/wishlist/";
	$wishlistHTML = file_get_contents($url);
	$contains = strpos($wishlistHTML, "<div id=\"wishlist_items\">");
	if($contains != False) {
		$DOM = new DOMDocument();
		@$DOM->loadHTML($wishlistHTML);
		$xpath = new DOMXPath($DOM);

		$list = $xpath->query("//div[contains(concat(' ',normalize-space(@class),' '), 'wishlistRow')]/@id");
		$listName = $xpath->query("//h4[contains(concat(' ',normalize-space(@class),' '), 'ellipsis')]");

		$first = True;
		$index = 0;
		echo "{\"wishlist\": {";
		foreach ($list as $appid) {
			if ($first == False) echo ", ";
			$first = False;
			echo "\"" . substr($appid->nodeValue, 5) . "\": \"" . $listName->item($index)->nodeValue . "\"";
			$index++;
		}
		echo "} }";
	} else {
		echo "{\"message\": \"No wishlist items\"}";
	}
} else {
	echo "{\"message\": \"No steam profile argument\"}";
}

?>