define(function (require) {
    'use strict';

    /**
     * todo load answer from server (restore state after reload)
     * todo pass Quiz model to enable possibility to pick quiz data for server requests
     */
    var Question_Model = Backbone.Model.extend({
        defaults: {
            bankid: null,
            name: null,
            cloze: null,
            fileid: null,
            answertype: null,
            enumtype: null,
            enumtype2: null,
            grade: null,
            penalty: null,
            timelimit: null,
            shuffleanswers: null,
            questionselect: null, // multi-choice questions

            // Intro, that is taken from another request
            intro: null,

            // Matches for matching question
            matches: null,

            // Sub-questions for Cloze
            subquestions: [],

            // Flag that indicates that question is fully fetched from server
            // (due to the fact questions may have multiple requests, just accessing some property won't work)
            loaded: false
        },

        /**
         * Private properties
         */
        // Amount of requests needed to fully load question data
        // Usually questions need 2 requests — intro + info
        _maxRequests: 2,
        // Number of requests made during this fetch session
        _requestsCounter: 0,
        // Quiz model
        _quizModel: null,

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
            this._requestsCounter = 0;

            $.ajax({
                url: '/quiz/xmlquestion?id=' + this.get('id'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: _.bind(this._onFetchInfoSuccess, this, fetchOptions),
                error: fetchOptions.error || function () {
                }
            });
        },

        _onFetchInfoSuccess: function (fetchOptions, jqXHR) {
            // Send request for intro
            $.ajax({
                url: '/quiz/htmlquestion?id=' + this.get('id'),
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

            // Parse loaded info
            this._parseAndSetInfo(jqXHR);

            // Process specific questions
            if (this.get('answertype') == 'Matching') {
                this._maxRequests++; // requires additional request
                $.ajax({
                    url: '/quiz/xmlquestionmatching?id=' + this.get('id'),
                    dataType: 'xml',
                    contentType: 'application/xml',
                    success: _.bind(function (fetchOptions, jqXHR) {
                        this._parseAndSetMatching(jqXHR);
                        this._registerFetchRequestCompleted(fetchOptions);
                    }, this, fetchOptions),
                    error: _.bind(function (fetchOptions) {
                        //this._registerFetchRequestCompleted(fetchOptions);
                    }, this, fetchOptions)
                });
            }

            this._registerFetchRequestCompleted(fetchOptions);
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
                            this.set('answertype', 'Essay');
                            break;
                        case 3: // Multiple choice
                            this.set('answertype', 'MultiChoice');
                            break;
                        case 4: // Simple recording
                            this.set('answertype', 'SimpleRecording');
                            break;
                        case 5: // Short text answer
                            this.set('answertype', 'Text');
                            break;
                        case 6: // Cloze
                            this.set('answertype', 'Cloze');
                            break;
                        case 7: // Matching
                        case 11: // True/false - true =))))))
                        case 12: // True/false - false =))))))
                            this.set('answertype', 'Matching');
                            break;
                        case 13: // Comparative recording
                            this.set('answertype', 'ComparativeRecording');
                            break;
                        case 0: // Description
                        case 2:
                        case 8:
                        case 9:
                        default :
                            this.set('answertype', 'Empty');
                            break;
                    }
                } else if (item.nodeName == 'questionselect') {
                    var tmp = [];
                    $(item).find('items').each(function (index, item) {
                        tmp.push({
                            id: $(this).find('id').text(),
                            valid: $(this).find('valid').text(),
                            enum: $(this).find('enum').text(),
                            value: $(this).find('value').text()
                        });
                    });
                    this.set('questionselect', tmp);
                } else if (item.nodeName == 'subquestions') {
                    var tmp = [];
                    $(item).find('> question').each(_.bind(function(index, item){
                        var subQuestion = new Question_Model();
                        this._parseAndSetInfo.call(subQuestion, item);
                        tmp.push(subQuestion);
                    }, this));
                    this.set('subquestions', tmp);
                } else {
                    this.set(item.nodeName, $(item).text());
                }
            }, this));
        },

        _parseAndSetMatching: function (jqXHR) {
            var tmp = {
                left: [],
                right: []
            };
            $(jqXHR).find('item1').each(function () {
                tmp.left.push({
                    id: $(this).find('id').text(),
                    slot: $(this).find('slot').text(),
                    enum: $(this).find('enum').text(),
                    value: $(this).find('value').text()
                });
            });
            $(jqXHR).find('item2').each(function () {
                tmp.right.push({
                    id: $(this).find('id').text(),
                    slot: $(this).find('slot').text(),
                    enum: $(this).find('enum').text(),
                    value: $(this).find('value').text()
                });
            });

            this.set('matches', tmp);
        },


        getSubQuestion: function(id) {
            var subQuestions = this.get('subquestions');
            for (var i = 0; i < subQuestions.length; i++) {
                if (subQuestions[i].get('id') == id) {
                    return subQuestions[i];
                }
            }
        }
    });

    return Question_Model;
});