<?php 

$humbleHTML = "";
if (isset($_GET['url'])) {
	$humbleHTML = file_get_contents($_GET['url']);
}
else {
	$humbleHTML = file_get_contents("https://www.humblebundle.com/");
}

$DOM = new DOMDocument();
@$DOM->loadHTML($humbleHTML);
$xpath = new DOMXPath($DOM);

$machineNames = $xpath->query("//ul[contains(concat(' ',normalize-space(@class),' '), 'game-boxes')]/li/div/a/@data-machine-name");

foreach ($machineNames as $name) {
	echo $name->nodeValue , "<br />";
}

 ?>