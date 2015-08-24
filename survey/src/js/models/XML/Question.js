define(function (require) {
    'use strict';

    /**
     * todo load answer from server (restore state after reload)
     * todo pass Quiz model to enable possibility to pick quiz data for server requests
     */
    var Question_Model = Backbone.Model.extend({
        defaults: {
            id: null,
            objectid: null,
            displayorder: null,
            fileid: null,
            answertype: null,
            enumtype: null,
            allowmultiple: 0,

            options: null, // multi-choice questions

            // Flag that indicates that question is fully fetched from server
            // (due to the fact questions may have multiple requests, just accessing some property won't work)
            loaded: false
        },

        /**
         * Private properties
         */
        // Amount of requests needed to fully load question data
        // Usually questions need 2 requests — intro + info
        _maxRequests: 1,
        // Number of requests made during this fetch session
        _requestsCounter: 0,

        initialize: function (defaults, options) {
        },

        /**
         * Overrides
         */

        /**
         *
         * @param fetchOptions
         * @returns {*}
         */
        fetch: function (fetchOptions) {
            // Send request for intro
            $.ajax({
                url: '/survey/htmlquestion?id=' + this.get('id'),
                dataType: 'html',
                contentType: 'text/html',
                success: _.bind(function (fetchOptions, data) {
                    this.set('intro', data);
                    this._registerFetchRequestCompleted(fetchOptions);
                }, this, fetchOptions),
                error: _.bind(function (fetchOptions) {
                    this._registerFetchRequestCompleted(fetchOptions);
                }, this, fetchOptions)
            });
        },


        _registerFetchRequestCompleted: function (fetchOptions) {
            this._requestsCounter++;
            if (this._requestsCounter == this._maxRequests) {
                this.set('loaded', true);
                fetchOptions.success.call();
            }
        },


        /**
         * Utility methods, just to make code more readable
         */
        _parseAndSetInfo: function (jqXHR) {
            if (jqXHR.nodeName == '#document') {
                jqXHR = $(jqXHR).find('question').first();
            }
            $(jqXHR).find('> *').each(_.bind(function (index, item) {
                if (item.nodeName == 'answertype') {
                    switch (parseInt($(item).text())) {
                        case 1: // Long text essay
                            this.set('answertype', 'Text');
                            break;
                        case 2: // Multiple choice
                            this.set('answertype', 'MultiChoice');
                            break;
                        case 3: // Simple recording
                            this.set('answertype', 'Rank');
                            break;
                        default :
                            this.set('answertype', 'Empty');
                            break;
                    }
                } else if (item.nodeName == 'options') {
                    var tmp = [];
                    $(item).find('option').each(function (index, item) {
                        tmp.push({
                            id: $(this).find('id').text(),
                            surveyid: $(this).find('surveyid').text(),
                            enum: $(this).find('enum').text(),
                            value: $(this).find('value').text(),
                            fileid: $(this).find('fileid').text()
                        });
                    });
                    this.set('options', tmp);
                } else {
                    this.set(item.nodeName, $(item).text());
                }
            }, this));
        },


        fromDomNode: function(node) {
            this._parseAndSetInfo(node);

            return this;
        }
    });

    return Question_Model;
});