var matched = uaMatch(window.navigator.userAgent);

//if (matched.platform === 'cros' || matched.platform === 'mac' || matched.platform === 'linux' || matched.platform === 'win') {

// todo move those css invokation to html head or move from html head here
loadCss('/bower_components/jquery-ui/themes/base/jquery-ui.min.css');

require.config({
    waitSeconds: 60,
    paths: {
        html: 'src/html',
        js: 'src/js',
        views: 'src/js/views',
        models: 'src/js/models',

        'jquery': '/bower_components/jquery/dist/jquery.min',
        'jquery-ui': '/bower_components/jquery-ui/jquery-ui.min',
        'underscore': '/bower_components/underscore/underscore',
        'backbone': '/bower_components/backbone/backbone',
        'text': '/bower_components/requirejs-text/text'
    },

    shim: {
        'underscore': {
            exports: '_'
        },
        'jquery-ui': {
            deps: ['jquery']
        }
    }
});

require([
    'jquery',
    'jquery-ui',
    'underscore',
    'backbone'
], function () {
    require(['views/Flashcard'], function (Flashcard_View) {
        flashcard = new Flashcard_View({
            element: $('#FlashcardContainer'),
            // todo pass quizId variable instead of using global namespace
            flashcardId: flashcardId
        });
    });
});
//} else {
//
//}


function uaMatch(ua) {
    ua = ua.toLowerCase();

    var match = /(opr)[\/]([\w.]+)/.exec(ua) ||
        /(chrome)[ \/]([\w.]+)/.exec(ua) ||
        /(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua) ||
        /(webkit)[ \/]([\w.]+)/.exec(ua) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua) ||
        /(msie) ([\w.]+)/.exec(ua) ||
        ua.indexOf("trident") >= 0 && /(rv)(?::| )([\w.]+)/.exec(ua) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
        [];

    var platform_match = /(ipad)/.exec(ua) ||
        /(iphone)/.exec(ua) ||
        /(android)/.exec(ua) ||
        /(windows phone)/.exec(ua) ||
        /(blackberry)/.exec(ua) ||
        /(win)/.exec(ua) ||
        /(mac)/.exec(ua) ||
        /(linux)/.exec(ua) ||
        /(cros)/i.exec(ua) ||
        [];

    return {
        browser: match[3] || match[1] || "",
        version: match[2] || "0",
        platform: platform_match[0] || ""
    };
}

function loadCss(url) {
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
}