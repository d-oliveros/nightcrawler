## Nightcrawler

Nightcrawler is a Tor control interface and IP hopper. This does not magically proxy all your node connections through Tor, so you need to explicitly use your proxy in the requests you make.

#### Requirements

You need to install Tor, and set up a Tor-backed HTTP proxy to be able to use this module.

- `Tor` (Not `Tor Bundle`, just `Tor`).
- `Polipo`, or other web proxy.

See [Using Tor with Polipo](http://www.pps.univ-paris-diderot.fr/~jch/software/polipo/tor.html)

You also have to enable Tor's control interface in your `torrc` configuration file by adding the lines:

- `ControlPort 9051` - The port of Tor's control interface. 9051 is the default.
- `HashedControlPassword myhashedpassword` - Your hashed password. To hash your password, see [--hash-password](https://www.torproject.org/docs/tor-manual.html.en#opt-hash-password).

See [Advanced Tor usage](https://www.torproject.org/docs/faq.html.en#torrc)


### Installation

```js
npm install nightcrawler
```

### How to use

##### Todo: write better documentation.

```js
var settings = {

	// Your Tor-Backed HTTP proxy URL
	proxy: 'http://localhost:8118',
	
	tor: {
		// Tor Control interface password
		password: ``,
		
		// Not to be confused with Tor's SOCKS4a proxy port, which defaults to 9050
		controlPort: 9051
	},
};

var nightcrawler  =  new Nightcrawler(settings);

// Changes Tor's IP.
nightcrawler.changeIp().then( function(ip) {
	console.log(ip) // New external IP
});

// Get the current IP
nightcrawler.getIp().then( function(ip) {
	console.log('My current IP is: '+ip);
})

// My IP will now change every minute
nightcrawler.conceal(60);

// My IP will stop changing
nightcrawler.conceal(0);


nightcrawler.info().then( function(info) {

	console.log(info.usingTor); // True or False. Are you using Tor?
	console.log(info.ip);       // Your external IP

});
```

###### Why a factory and not a singleton?

Because multiple nightcrawlers may be instanciated using multiple HTTP proxies.

### Tests

```js
make test
```

Cheers.
