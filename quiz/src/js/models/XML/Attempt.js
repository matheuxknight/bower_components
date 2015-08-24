define(function (require) {
    'use strict';

    /**
     */
    var Attempt_Model = Backbone.Model.extend({
        defaults: {
            id: null,
            quizId: null,
            userId: null,
            courseId: null,
            started: null,
            duration: null,
            status: null,
            currentQuestion: null,
            result: null
        },

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
            $.ajax({
                url: '/quiz/xmlattempt?id=' + this.get('id'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: _.bind(this._onFetchSuccess, this, fetchOptions),
                error: fetchOptions.error || function () {
                }
            });
        },

        start: function (startOptions) {
            $.ajax({
                url: '/quiz/startquiz?id=' + this.get('quizId'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: _.bind(this._onFetchSuccess, this, startOptions),
                error: startOptions.error || function () {
                }
            });
        },

        complete: function (completeOptions) {
            $.ajax({
                url: '/quiz/completequiz?attemptid=' + this.get('id'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: completeOptions.success || function () {
                },
                error: completeOptions.error || function () {
                }
            });
        },

        cancel: function (cancelOptions) {
            $.ajax({
                url: '/quiz/cancelquiz?attemptid=' + this.get('id'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: cancelOptions.success || function () {
                },
                error: cancelOptions.error || function () {
                }
            });
        },

        _onFetchSuccess: function (startOptions, jqXHR) {
            $(jqXHR).find('result *').each(_.bind(function (index, node) {
                this.set(node.nodeName, $(node).text());
            }, this));

            startOptions.success.call();
        }
    });

    return Attempt_Model;
});