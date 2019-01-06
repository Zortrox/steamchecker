<!DOCTYPE html>
<html>
<head>
	<title>SteamChecker | FoxSlash</title>
	<meta name="description" content="SteamChecker, the main page of the browser extension that highlights and grays-out Steam games across bundle sites based on your library and wishlist.">
	<link href="style.css" rel="stylesheet" type="text/css">
	<script type="text/javascript" src="/js/jquery-2.2.1.min.js"></script>
</head>
<body>

<div class="wrapper">
<h1>SteamChecker</h1>
<p>Besides looking through every one of your steam games, searching for a specific game to see if you own it or not, there is no way of determining if a bundle you're about to get on HumbleBundle.com has games in your Steam library.  Although it may be cheap, spending money on a 10-game bundle where you already owned 9 of the games always makes me frustrated, so I created this extension!  This will gray-out any game you own on Steam that is on any of the weekly bundles to let you know if you own the game or not.  It also has wishlist support to highlight games you want on Steam!</p>
<h3>How to Use</h3>
<p>There will be a new extension icon in Chrome.  Click on that to input your 64bit SteamID or steam profile name (NOT nickname) if you have set your URL.  Click "Save" and you're done!  Your SteamID or profile name can be found in your profile URL "steamcommunity.com/id/XXXXXXXXXX/" or "steamcommunity.com/profiles/XXXXXXXXXXXXXXXXXX/"</p>
<p>Note: Humble Bundle uses a different naming format than Steam does for some games, but I will try to keep the alias file as up to date as possible whenever new bundles come out or new games are added to a bundle.  If you see that games aren't showing up in a bundle, don't hesitate to contact me!</p>
<h2>Download</h2>
<p><a href="https://chrome.google.com/webstore/detail/steam-library-checker/eopegaefgepfdedhecfbclehhffiebpk" target="_blank">Chrome Web Store</a></p>
<h2>Contact</h2>
<p>you can always send me a message on Twitter (<a href="https://www.twitter.com/Zortrox" target="_blank">@Zortrox</a>) or email me (<a id="email">zortrox</a>) if you have questions or comments or anything.</p>
<h2>Version History</h2>
<div class="minimizeBlock" id="miniVersion">
	<h3>Version 0.6</h3>
	<ul>
		<li>Updated code for Humble Bundle changed HTML layout/structure</li>
   		<li>Changed the display of wishlisted and owned games</li>
   		<li>Database created to update aliases faster and more accurately</li>
	</ul>
	<h3>Version 0.5.1</h3>
	<ul>
		<li>Firefox support added!</li>
   		<li>Fixed jQuery file so it could pass the Mozilla review &gt;_&gt;</li>
	</ul>
	<h3>Version 0.4</h3>
	<ul>
		<li>Libraries should now load MUCH quicker</li>
   		<li>Backend changes to wishlist/alias loading</li>
	</ul>
	<h3>Version 0.3</h3>
	<ul>
		<li>NAME CHANGE! (Sounds a little cooler :D )</li>
		<li>Added easeing to owned and wishlisted games</li>
		<li>Fixed bug with no messages showing on invalid profile names</li>
		<li>Huge wishlist support</li>
	</ul>
	<h3>Version 0.2.1</h3>
	<ul>
		<li>Added alias support to wishlist games</li>
	</ul>
	<h3>Version 0.2</h3>
	<ul>
		<li>Wishlist support - Games are now highlighted yellow if they're in your wishlist</li>
		<li>Alias file - Alias file now delivered with server, so no longer have to update extension to get newest names</li>
	</ul>
	<h3>Version 0.1</h3>
	<ul>
		<li>Initial release</li>
	</ul>
</div>
</div>

<script type="text/javascript">
	$("#email").attr("href", "mailto:zortrox@gmail.com");
</script>

</body>
</html>