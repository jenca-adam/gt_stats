if (!document.localStorage.getItem("shown_alert")){
	document.localStorage.setItem("shown_alert", "yes :(");
	showModalDialog(NOTICE, "gtedit.tech will be temporarily shutting down on January 12th.<br>The webhosting costs quite a bit of money that I don't get back, therefore I've decided to temporarily shut down this website, until I can find a less predatory hosting service that will fit my needs.<br>Until then, please refer to the Hosting locally section in the readme on GitHub.\nThanks for understanding.\n&nbsp;&nbsp;&mdash;vcgd <3")
}
