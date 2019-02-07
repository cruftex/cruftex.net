
function populateShareCounts(url) {
  $.getJSON(url, null, function(j){

    var services= [
      "delicious",
      "facebook",
      "google-plus",
      "linkedin",
      "pinterest",
      "reddit",
      "stumbleupon",
      "twitter",
      "digg",
      "hacker-news"
    ];

    function shortenCount(c) {
      if (c >= 9000) {
        return ">9k"
      }
      if (c >= 1000) {
        return c/1000 + "k"
      }
      return c;
    }

    for (var i = 0; i < services.length; i++) {
      var service = services[i];
      if (j[service] > 0) {
        $(".fa-"+service).after('<span class="count count-'+service+'">'+shortenCount(j[service]) +'</span>');
        $("span.count").fadeIn();
      }
    }

  } );
}