<?php

header('Content-Type: application/json;charset=utf-8');
header("Access-Control-Allow-Origin: *");

if (isset($_GET['type']) && isset($_GET['id'])) {
	$type = $_GET['type'];
	$id = $_GET['id'];


	$url = 'https://store.steampowered.com/wishlist/' . ($type == 'id' ? 'id' : 'profiles') . '/' . $id;
	if (substr($url, -1) == "/") $url = substr($url, 0, strlen($url) - 1);
	$wishlistHTML = file_get_contents($url);
	$contains = strpos($wishlistHTML, "g_rgWishlistData");
	if($contains != false) {
		$js_array_found = [];
		preg_match('/(?<=g_rgWishlistData = )\\[.*?\\]/',  $wishlistHTML, $js_array_found);

		if (count($js_array_found) > 0) {
			$json_array = json_decode('{ "appids": [' . substr($js_array_found[0], 1, -1) . ']}');
			$list = $json_array->appids;

			$first = true;
			echo "{\"wishlist\": [";
			foreach ($list as $appid) {
				if ( !$first ) echo ", ";
				$first = false;
				echo "\"" . $appid->appid . "\"";
			}
			echo "] }";
		} else {
			echo "{\"message\": \"No wishlist items\"}";
		}
	} else {
		echo "{\"message\": \"No wishlist items\"}";
	}
} else {
	echo "{\"message\": \"No steam profile argument\"}";
}

?>