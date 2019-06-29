<?php

header('Content-Type: application/json;charset=utf-8');
header("Access-Control-Allow-Origin: *");

$gameAliases = isset($_GET["a"]) ? $_GET["a"] : 0;
$gameAll = isset($_GET["all"]) ? true : false;

//get steam game IDs of all aliases
if ($gameAliases || $gameAll) {
	//connect
	$db = new mysqli('mysql.foxslash.com', 'zortrox', 'Geonosis.13', "steam_checker");
	if ($db ->connect_errno) { 
		die('Could not connect: ' . mysqli_error());
	}
	mysqli_set_charset($db, "utf8");

	$values = "";
	$loops = 0;

	if (!$gameAll) {
		$values = " WHERE ";
		foreach ($gameAliases as $value) {
			if ($loops != 0) $values .= " OR ";
			$values .= "alias=\"" . mysqli_real_escape_string($db, $value) . "\"";
			$loops++;
		}
	}
	
	//get the steam ids
	$aliases = array();
	$question = "";
	$aliasQuery = $db->query("SELECT * FROM alias" . $values);
	if ($aliasQuery) {
		$numRows = $aliasQuery->num_rows;
		if ($numRows > 0) {
			while ($row = $aliasQuery->fetch_assoc()) {
				if (!array_key_exists($row["id"], $aliases)) {
					$aliases[$row["id"]] = array();
				}
				array_push($aliases[$row["id"]], $row["name"]);
			}
		}
	}

	echo json_encode($aliases);

} else {
	//POST poll id wrong
	echo "{}";
}

?>