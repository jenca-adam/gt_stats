const ENABLE_NOTICE=false;
function showModalDialog(title, text){
    $("#modal-title").text(title);
    $("#modal-body").html(text);
    $("#modal-container").show();
}
if (!window.localStorage.getItem("shown_alert")&&ENABLE_NOTICE){
	window.localStorage.setItem("shown_alert", "yes :(");
	showModalDialog("NOTICE", "gtedit.tech will be temporarily shutting down on the 12th of January.<br>The webhosting costs quite a bit of money that I don't get back, therefore I've decided to temporarily shut down this website, until I can find a less predatory hosting service that will suit my needs.<br>In the meantime, please refer to the <a href=\"https://github.com/jenca-adam/gt_stats#hosting-locally\" target=\"_blank\">Hosting locally</a> section in the readme on GitHub.<br>Thanks for understanding.<br>&nbsp;&nbsp;&mdash;vcgd <3")
}

$("#modal-close").click(()=>{$("#modal-container").hide()});
