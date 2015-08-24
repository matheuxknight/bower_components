define(function (require) {
    'use strict';

    var Quiz_Model = Backbone.Model.extend({
        defaults: {
            // Infos
            userid: null,
            username: null,
            userimage: null,
            quizid: null,
            quizname: null,
            quizimage: null,
            courseid: null,
            coursename: null,
            allowback: null,
            allowvideo: null,
            allowedattempt: null,
            timelimit: null,
            expiredaction: null,
            passthreshold: null,
            gradingmethod: null,
            applypenalties: null,
            passfeedback: null,
            failfeedback: null,
            questionperpage: null,
            shufflequestion: null,
            usedevices: null,
            questioncount: null,
            attemptcount: null,
            attemptid: null,
            currentquestion: null,
            starttime: null,

            // Questions Order
            quizquestions: []
        },

        initialize: function () {
        },

        /**
         * Overrides
         */

        /**
         *
         * @param options
         * @returns {*}
         */
        fetch: function(options) {
            return Quiz_Model.__super__.fetch.call(this, _.extend(options, {
                dataType: 'xml',
                contentType: 'application/xml'
            }));
        },

        parse: function(jqXHR, options){
            var info = {};
            $(jqXHR).find('data quizinfo *').each(function () {
                info[this.nodeName] = $(this).text();
            });
            info.quizquestions = [];
            $(jqXHR).find('data quizquestions value').each(function () {
                info.quizquestions.push($(this).text());
            });

            return info;
        },

        url: function(){
            return '/quiz/xmlquiz?id='+this.get('id')
        }
    });

    return Quiz_Model;
});