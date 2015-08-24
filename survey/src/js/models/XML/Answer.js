define(function (require) {
    'use strict';

    var Answer_Model = Backbone.Model.extend({
        defaults: {
            id: null,
            answertext: null,
            answerselect: [],
            answerranks: {}
        },

        _questionModel: null,

        initialize: function (defaults, options) {
        },

        setQuestionModel: function (questionModel) {
            this._questionModel = questionModel;
        },

        getQuestionModel: function () {
            return this._questionModel;
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
                url: '/survey/xmlanswer?id=' + this.get('id'),
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

            var answerSelects = [];
            var answerRanks = {};
            $(jqXHR).find('> *').each(_.bind(function (index, node) {
                if (node.nodeName == 'answerselect') {
                    answerSelects.push($(node).text());
                } else if (node.nodeName == 'answerranks') {
                    answerRanks[$(node).find('answerselect').text()] = $(node).find('answerrank').text();
                } else {
                    this.set(node.nodeName, $(node).text());
                }
            }, this));
            this.set('answerranks', answerRanks);
            this.set('answerselect', answerSelects);
            this.set('loaded', true);

            fetchOptions.success.call();
        },

        /**
         */
        submitAnswer: function () {
            if (this._questionModel.get('answertype') == 'Essay' && this.get('attachment')) {
                var fd = new FormData();
                fd.append('attachment', this.get('attachment'));
                fd.append('questionid', this.get('questionid'));
                fd.append('answerlong', this.get('answerlong'));
                $.ajax({
                    type: 'POST',
                    url: '/survey/saveanswer',
                    data: fd,
                    processData: false,
                    contentType: false
                }).done(function (data) {
                    //console.log(data);
                });
            } else {
                $.ajax({
                    url: '/survey/saveanswer',
                    method: 'get',
                    data: this.toJSON()
                });
            }
        },

        isAnswered: function () {
            if (this._questionModel.get('answertype') == 'Empty') return true;
            if (this.get('answertext')) return true;
            if (this.get('answerselect')) return true;

            return false;
        }
    });

    return Answer_Model;
});