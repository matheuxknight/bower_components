define(function (require) {
    'use strict';

    var Question_Model = require('models/XML/Question');

    var Survey_Model = Backbone.Model.extend({
        defaults: {
            id: null,
            type: null,
            name: null,
            parentid: null,
            parentname: null,
            authorid: null,
            size: null,
            duration: null,
            image: null,
            canwrite: null,
            message: null
        },

        _questionModels: [],

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
        fetch: function (fetchOptions) {
            $.ajax({
                url: '/survey/xmlsurvey?id=' + this.get('id'),
                dataType: 'xml',
                contentType: 'application/xml',
                success: _.bind(this._onFetchInfoSuccess, this, fetchOptions),
                error: fetchOptions.error || function () {
                }
            });
        },

        _onFetchInfoSuccess: function (fetchOptions, jqXHR) {
            $(jqXHR).find('object > *').each(_.bind(function (index, item) {
                this.set(item.nodeName, $(item).text());
            }, this));

            $(jqXHR).find('surveys > survey').each(_.bind(function (index, item) {
                this._questionModels.push((new Question_Model()).fromDomNode(item));
            }, this));

            fetchOptions.success.call();
        },

        getQuestionModels: function () {
            return this._questionModels;
        }
    });

    return Survey_Model;
});