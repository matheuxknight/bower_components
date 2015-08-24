define(function (require) {
    'use strict';

    /**
     * todo add "changed" flag to avoid sending requests when answer wasn't changed by user
     */
    var Answer_Model = Backbone.Model.extend({
        defaults: {
            id: null,
            attemptid: null,
            questionid: null,
            answershort: null,
            answerlong: null,
            answerfileid: null,
            answerselectid: null,
            answermatchingid1: null,
            answermatchingid2: null,
            result: null,
            comment: null,

            // Matches
            answermatchings: {}
        },

        _parentModel: null,
        _questionModel: null,

        // For cloze
        _subanswers: [],

        initialize: function (defaults, options) {
        },

        setQuestionModel: function (questionModel) {
            this._questionModel = questionModel;
        },

        getQuestionModel: function () {
            return this._questionModel;
        },

        setParentModel: function (answerModel) {
            this._parentModel = answerModel;
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
                url: '/quiz/xmlanswer?attemptid=' + this.get('attemptid') + '&questionid=' + this.get('questionid'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: _.bind(this._onFetchSuccess, this, fetchOptions),
                error: fetchOptions.error || function () {
                }
            });
        },

        /**
         * @param fetchOptions
         * @param jqXHR
         * @private
         */
        _onFetchSuccess: function (fetchOptions, jqXHR) {
            if (jqXHR.nodeName == '#document') {
                jqXHR = $(jqXHR).find('answer').first();
            }

            $(jqXHR).find('> *').each(_.bind(function (index, node) {
                if (node.nodeName == 'subanswers') {
                    var tmp = [];
                    $(node).find('> answer').each(_.bind(function (index, node) {
                        var subAnswer = new Answer_Model({attemptid: this.get('attemptid')});
                        subAnswer.setParentModel(this);
                        this._onFetchSuccess.call(subAnswer, fetchOptions, node);
                        tmp.push(subAnswer);
                    }, this));
                    this._subanswers = tmp;
                } else if (node.nodeName == 'questionid' && this._parentModel) {
                    this.set(node.nodeName, $(node).text());
                    this._questionModel = this._parentModel.getQuestionModel().getSubQuestion($(node).text());
                } else {
                    this.set(node.nodeName, $(node).text());
                }
            }, this));

            var tmp = {};
            $(jqXHR).find('> answermatchings').each(_.bind(function (index, node) {
                tmp[$(node).find('answermatchingid1').text()] = $(node).find('answermatchingid2').text();
            }, this));
            this.set('answermatchings', tmp);

            this.set('loaded', true);

            fetchOptions.success.call();
        },

        /**
         */
        submitAnswer: function () {
            if (this._subanswers.length) {
                // this is cloze
                for (var i = 0; i < this._subanswers.length; i++) {
                    this._subanswers[i].submitAnswer();
                }
            } else if (this._questionModel.get('answertype') == 'SimpleRecording' || this._questionModel.get('answertype') == 'ComparativeRecording') {
                if (this.get('record')) {
                    // Record will only appear in model if user recorded it. Load state will not populate this field
                    // todo record was updated since last submit to server
                    var fd = new FormData();
                    fd.append('record', this.get('record'));
                    fd.append('attemptid', this.get('attemptid'));
                    fd.append('questionid', this.get('questionid'));
                    $.ajax({
                        type: 'POST',
                        url: '/quiz/saveanswer',
                        data: fd,
                        processData: false,
                        contentType: false
                    }).done(function (data) {
                        //console.log(data);
                    });
                }
            } else if (this._questionModel.get('answertype') == 'Essay' && this.get('attachment')) {
                var fd = new FormData();
                fd.append('attachment', this.get('attachment'));
                fd.append('attemptid', this.get('attemptid'));
                fd.append('questionid', this.get('questionid'));
                fd.append('answerlong', this.get('answerlong'));
                $.ajax({
                    type: 'POST',
                    url: '/quiz/saveanswer',
                    data: fd,
                    processData: false,
                    contentType: false
                }).done(function (data) {
                    //console.log(data);
                });
            } else {
                $.ajax({
                    url: '/quiz/saveanswer',
                    method: 'get',
                    data: this.toJSON()
                });
            }
        },


        getSubAnswerByQuestionId: function (questionId) {
            for (var i = 0; i < this._subanswers.length; i++) {
                if (this._subanswers[i].get('questionid') == questionId) {
                    return this._subanswers[i];
                }
            }
        },

        isAnswered: function () {
            if (this._questionModel.get('answertype') == 'Empty') return true;
            if (this.get('answershort')) return true;
            if (this.get('answerlong') && this.get('answerlong').replace(/(<([^>]+)>)/ig, "")) return true;
            if (this.get('answerselectid')) return true;
            if (!$.isEmptyObject(this.get('answermatchings'))) return true;
            if (this.get('fileid') || this.get('record')) return true;

            for (var i = 0; i < this._subanswers.length; i++) {
                if (this._subanswers[i].isAnswered())
                    return true;
            }

            return false;
        }
    });

    return Answer_Model;
});