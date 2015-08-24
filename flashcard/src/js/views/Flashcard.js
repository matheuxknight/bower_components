define(function (require) {
    'use strict';

    // Dependencies
    var template = {
            container: {
                Loading: _.template(require('text!html/Container/Loading.html')),
                Normal: _.template(require('text!html/Container/Normal.html'))
            },
            flashcard: {
                Loading: _.template(require('text!html/Card/Loading.html')),
                Normal: _.template(require('text!html/Card/Normal.html'))
            }
        },
        Flashcard_Model = require('models/XML/Flashcard');
    /**
     */
    var Flashcard_View = Backbone.View.extend({

        events: {
            'click [data-role="navigation-next"]': '_onNavigationNextClick',
            'click [data-role="navigation-previous"]': '_onNavigationPreviousClick',
            'click [data-role="full-navigation-button"]': '_onFullNavigationButtonClick',
            'click [data-role="navigation-number"]': '_onNavigationNumberClick',
            'click [data-role="attempt-cancel"]': '_onAttemptCancelClick'
        },

        /**
         * Private properties
         */
        _cards: [],
        _navigationLocked: false,
        _currentCard: 0,
        _isAnimating: false,
        _flashcardModel: null,

        /**
         *
         * @param config
         */
        initialize: function (config) {
            this.setElement(config.element);

            this.$el.html(template.container.Loading(this));

            this._flashcardModel = new Flashcard_Model({id: config.flashcardId});

            this._flashcardModel.fetch({
                success: _.bind(this._onFlashcardDataLoaded, this),
                error: function () {
                    console.log('error loading quiz data', arguments);
                }
            });

            // For device rotation
            $(window).resize(_.bind(function () {
                for (var i = 0; i < this._cards.length; i++) {
                    //temp solution for sizing the card area onload. This lets me load screen at different resolutions
                    this._cards[i].$el.css({
                        width: this.$el.find('[data-role="cards-container"]').width() + 'px'
                    });
                }
                if (this._outro) {
                    this._outro.$el.css({
                        width: this.$el.find('[data-role="cards-container"]').width() + 'px'
                    });
                }
                if (this._cards.length) {
                    this._transitToSlide(this._currentCard, {
                        duration: 0
                    });
                }
            }, this));
        },

        /**
         * Own methods
         */

        /**
         * Render normal template, build cards array and start loading them
         * @private
         */
        _bootNormalState: function () {
            // Render normal view and start loading cards
            this.$el.html(template.container.Normal(this));

            // Build cards with loading template and inject them
            for (var i = 0; i < this._flashcardModel.get('flashcards').length; i++) {
                var card = {
                    id: this._flashcardModel.get('flashcards')[i].id,
                    data: this._flashcardModel.get('flashcards')[i],
                    index: i // Index of this card in this._cards
                };

                // Add card to storage
                this._cards.push(card);

                // Render loading state
                this._renderCard(card.index);
            }

            this._updateNavigation();
        },

        /**
         * Forbid user navigation
         * System methods may ignore this option
         * @returns {*}
         */
        lockNavigation: function () {
            this._navigationLocked = true;

            // todo disable navigation buttons

            return this;
        },

        /**
         * Allow user navigation
         * @returns {*}
         */
        unlockNavigation: function () {
            this._navigationLocked = false;

            // todo enable navigation buttons

            return this;
        },

        /**
         * @param index int
         * @private
         */
        _renderCard: function (index) {
            var card = this._cards[index]; // shortcut

            card.$el = $(template.flashcard.Normal(card));
            card.$el.data('card', card);

            card.$el.find('[data-role="card"]').on('click', function(){
                $(this).toggleClass('flipped');
            });

            this.$el.find('[data-role="cards-holder"]').append(card.$el);

            this._cards[card.index].$el.css({
                width: this.$el.find('[data-role="cards-container"]').width() + 'px'
            });
        },

        /**
         * Navigate to a card
         * @param index
         * @returns {*}
         */
        goToCard: function (index) {
            index = index * 1;
            if (this._cards.length < index || 0 > index)
                throw "No such card exists";

            this._isAnimating = true;
            this.lockNavigation();
            this._currentCard = index;

            this._updateNavigation(false);

            this._transitToSlide(index);
        },

        /**
         * Go to next card
         * @returns {*}
         */
        nextCard: function () {
            if (this._cards.length > 0 && this._currentCard >= this._cards.length - 1) {
                return this;
            } else if (this._cards.length == 0 && this._currentCard >= this._cards.length - 1) {
                return this;
            }

            return this.goToCard(this._currentCard + 1);
        },

        /**
         * Go to previous card
         * @returns {*}
         */
        previousCard: function () {
            if (this._currentCard <= 0) {
                return this;
            }

            return this.goToCard(this._currentCard - 1);
        },


        /**
         * todo rework to allow additional callback on finish instead of replacing one
         * @param index
         * @param options
         * @private
         */
        _transitToSlide: function (index, options) {
            options = _.extend({
                complete: _.bind(this._onTransitToSlideFinish, this),
                duration: 500
            }, options);

            this.$el.find('[data-role=cards-holder]').animate({
                // todo pick width some better way
                left: -this._cards[0].$el.outerWidth() * index
            }, options);
        },


        _updateNavigation: function (onlyStatus) {
            // Prev and next
            if (this._currentCard == 0) {
                this.$el.find('[data-role="navigation-previous"]').addClass('disabled');
            } else {
                this.$el.find('[data-role="navigation-previous"]').removeClass('disabled');
            }

            if (this._currentCard == this._cards.length - 1) {
                this.$el.find('[data-role="navigation-next"]').addClass('disabled');
            } else {
                this.$el.find('[data-role="navigation-next"]').removeClass('disabled');
            }

            // Numbered buttons classes
            this.$el.find('[data-role="navigation-number"]').each(_.bind(function (index, button) {
                //if (this._cards[$(button).attr('data-card-index')].answerModel.isAnswered()) {
                //    $(button).addClass('answered');
                //} else {
                //    $(button).removeClass('answered');
                //}

                if (this._currentCard == $(button).attr('data-card-index')) {
                    $(button).addClass('current');
                } else {
                    $(button).removeClass('current');
                }
            }, this));

            // Numbered buttons line rotation
            if (!onlyStatus) {
                this.$el.find('[data-role="quick-navigation"]').animate({
                    left: -(this.$el.find('[data-role="quick-navigation"] li').outerWidth(true) * this._currentCard
                    + this.$el.find('[data-role="quick-navigation"] li').width() / 2) + 'px'
                }, {
                    duration: 500
                });
            }
        },


        /**
         * Models events
         */

        /**
         * @private
         */
        _onFlashcardDataLoaded: function () {
            this._bootNormalState();
        },


        /**
         * Own events
         */

        /**
         * Called when animation of cards transition is finished
         * todo check quiz settings before unlocking navigation
         * @private
         */
        _onTransitToSlideFinish: function () {
            window.scrollTo(0, 0);
            this.isAnimating = false;
            this.unlockNavigation();

            this._updateNavigation();
        },

        /**
         * No idea what this can possibly be used for, but why not?
         * This method is only invoked when card is loaded in normal state (not when "loading" template is in use)
         * todo reconsider presence of this method in favor of moving it to helpers
         * @param card
         * @private
         */
        _cardPreRender: function (card) {
        },

        /**
         * Good place to boot ckeditor or jsPlumb
         * This method is only invoked when card is loaded in normal state (not when "loading" template is in use)
         * todo reconsider presence of this method in favor of moving it to helpers
         * @param card
         * @private
         */
        _cardPostRender: function (card) {
        },

        /**
         * User Event handlers
         */

        _onNavigationNextClick: function (event) {
            event.preventDefault();
            if (!this._navigationLocked)
                this.nextCard();
        },

        _onNavigationPreviousClick: function (event) {
            event.preventDefault();
            if (!this._navigationLocked)
                this.previousCard();
        },

        _onNavigationNumberClick: function (event) {
            event.preventDefault();

            if (!this._navigationLocked)
                this.goToCard($(event.target).attr('data-card-index'));
        },

        _onFullNavigationButtonClick: function (event) {
            event.preventDefault();

            this.$el.find('[data-role="full-navigation-holder"]').toggle(0);
        },

        _onAttemptCancelClick: function (event) {
            event.preventDefault();

            window.location = '/object?id=' + this._flashcardModel.get('id');
        }
    });

    return Flashcard_View;
});