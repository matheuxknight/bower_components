define(function (require) {
    'use strict';

    var Flashcard_Model = Backbone.Model.extend({
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
            message: null,

            flashcards: []
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
        fetch: function (fetchOptions) {
            $.ajax({
                url: '/flashcard/xmlflashcard?id=' + this.get('id'),
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

            var flashcards = [];
            $(jqXHR).find('flashcards > *').each(_.bind(function (index, item) {
                flashcards.push({
                    id: $(item).find('id').text(),
                    objectid: $(item).find('id').text(),
                    displayorder: $(item).find('id').text(),
                    question: {
                        value: $(item).find('item1 value').text(),
                        fileid: $(item).find('item1 fildeid').text()
                    },
                    answer: {
                        value: $(item).find('item2 value').text(),
                        fileid: $(item).find('item2 fildeid').text()
                    }
                });
            }, this));
            this.set('flashcards', flashcards);

            fetchOptions.success.call();
        }
    });

    return Flashcard_Model;
});