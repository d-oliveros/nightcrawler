### Nightcrawler

Tor interface & anonymizer / IP hopper.

#### Requirements

- `Tor` (Not `Tor Bundle`, just `Tor`).
- `Polipo`, or other web proxy.


#### How to use

###### Todo: write better documentation.

```js
var settings = {
	proxy: 'http://localhost:8118',
	tor: {
		password: ``,
		port: 9051,
	},
};

var nightcrawler  =  new Nightcrawler(settings);

nightcrawler.changeIp().then( function(ip) {
	// Who am I?
	console.log(ip) // New external IP
});

nightcrawler.getIp().then( function(ip) {
	console.log('My current IP is: '+ip);
})

// My IP will now change every minute
nightcrawler.conceal(60);

// My IP will stop changing
nightcrawler.conceal(0);


nightcrawler.info().then( function(info) {

	console.log(info.usingTor); // True or False. Are you using Tor?
	console.log(info.ip);       // Your current external IP

});
```