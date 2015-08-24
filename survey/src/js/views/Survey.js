define(function (require) {
    'use strict';

    // Dependencies
    var template = {
            survey: {
                Loading: _.template(require('text!html/Survey/Loading.html')),
                Normal: _.template(require('text!html/Survey/Normal.html'))
            },
            question: {
                Loading: _.template(require('text!html/Question/Loading.html')),
                Empty: _.template(require('text!html/Question/Empty.html')),
                Text: _.template(require('text!html/Question/Text.html')),
                Essay: _.template(require('text!html/Question/Essay.html')),
                Rank: _.template(require('text!html/Question/Rank.html')),
                MultiChoice: _.template(require('text!html/Question/MultiChoice.html'))
            }
        },
        Survey_Model = require('models/XML/Survey'),
        Question_Model = require('models/XML/Question'),
        Answer_Model = require('models/XML/Answer');

    var Survey_View = Backbone.View.extend({
        events: {
            'click [data-role="navigation-next"]': '_onNavigationNextClick',
            'click [data-role="navigation-previous"]': '_onNavigationPreviousClick',
            'click [data-role="navigation-number"]': '_onNavigationNumberClick',
            'click [data-role="full-navigation-button"]': '_onFullNavigationButtonClick',
            'click [data-role="diacritics-container"]': '_onDiacriticClick',
            'click [data-role="attempt-cancel"]': '_onAttemptCancelClick',
            'click [data-role="attempt-to-summary"]': '_onAttemptToSummaryClick',
            'click [data-role="attempt-submit"]': '_onAttemptSubmitClick',
            'focus input[type="text"]': '_onInputFocus',
            'blur input[type="text"]': '_onInputBlur'
        },

        /**
         * Private properties
         */
        _questions: [],
        _navigationLocked: true,
        _currentQuestion: 0,
        _isAnimating: false,
        _surveyModel: null,
        _activeInput: null,
        _diacriticsContainer: null,

        /**
         *
         * @param config
         */
        initialize: function (config) {
            this.setElement(config.element);

            this.$el.html(template.survey.Loading(this));

            this._surveyModel = new Survey_Model({id: config.surveyId});

            this._surveyModel.fetch({
                success: _.bind(this._onSurveyDataLoaded, this),
                error: function () {
                    console.log('error loading survey data', arguments);
                }
            });

            // For device rotation
            $(window).resize(_.bind(function () {
                for (var i = 0; i < this._questions.length; i++) {
                    //temp solution for sizing the question area onload. This lets me load screen at different resolutions
                    this._questions[i].$el.css({
                        width: this.$el.find('[data-role="questions-container"]').width() + 'px'
                    });
                }
                if (this._outro) {
                    this._outro.$el.css({
                        width: this.$el.find('[data-role="questions-container"]').width() + 'px'
                    });
                }
                if (this._questions.length) {
                    this._transitToSlide(this._currentQuestion, {
                        duration: 0
                    });
                }
            }, this));
        },

        /**
         * Own methods
         */

        /**
         * Render normal template, build questions array and start loading them
         * @private
         */
        _bootNormalState: function () {
            // Render normal view and start loading questions
            this.$el.html(template.survey.Normal(this));
            this._diacriticsContainer = this.$el.find('[data-role="diacritics-container"]');
            this._diacriticsContainer.tabs();

            // Build questions with loading template and inject them
            for (var i = 0; i < this._surveyModel.getQuestionModels().length; i++) {
                var question = {
                    id: this._surveyModel.getQuestionModels()[i].get('id'),
                    questionModel: this._surveyModel.getQuestionModels()[i],
                    answerModel: new Answer_Model({id: this._surveyModel.getQuestionModels()[i].get('id')}),
                    index: i // Index of this question in this._questions
                };

                question.answerModel.setQuestionModel(question.questionModel);

                // Add question to storage
                this._questions.push(question);

                // Render loading state
                this._renderQuestion(question.index);

                // Fetch question (html intro)
                question.questionModel.fetch({
                    success: _.bind(this._onQuestionDataLoaded, this, question),
                    error: function () {
                        console.log('error loading question data', arguments);
                    }
                });

                // Fetch answer
                question.answerModel.fetch({
                    success: _.bind(this._onAnswerLoaded, this, this._questions[i]),
                    error: function () {
                        console.log('error loading answer', arguments);
                    }
                });
            }

            // Align navigation
            this._updateNavigation(false);
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
         * This method is smart enough to decide that element doesn't need re-rendering so call it whenever you please
         * @param index int
         * @private
         */
        _renderQuestion: function (index) {
            var question = this._questions[index]; // shortcut

            // Let's figure out if this question has enough data to load in normal state
            if (question.questionModel.get('loaded') && question.answerModel.get('loaded')) {
                // This will only happen once... hopefully
                this._questionPreRender(question);
                var newLayout = $(template.question[question.questionModel.get('answertype')](question));
                this._questions[question.index].$el.replaceWith(newLayout);
                this._questions[question.index].$el = newLayout;
                this._questions[question.index].$el.data('question', this._questions[question.index]);
                // temp solution for sizing the question area onload. This lets me load screen at different resolutions
                this._questions[question.index].$el.css({
                    width: this.$el.find('[data-role="questions-container"]').width() + 'px'
                });
                this._questionPostRender(question);

                this._updateNavigation(true);
            } else if (!question.$el) {
                // Question is rendered for the first time
                question.$el = $(template.question.Loading());
                // Bind question object to DOM node via data — this way we can
                // later find question object when input event triggers
                //question.$el.width(this.$el.find('[data-role="questions-container"]').width());
                question.$el.data('question', question);
                // Inject element to container
                this.$el.find('[data-role="questions-holder"]').append(question.$el);

                $(window).resize();
            }
        },

        /**
         * Navigate to a question
         * @param index
         * @returns {*}
         */
        goToQuestion: function (index) {
            index = index * 1;
            if (this._questions.length < index || 0 > index)
                throw "No such question exists";

            // Compose and send an Answer to server
            this._submitAnswer(this._currentQuestion);

            // todo hide question counter when going to summary page
            // adjust current question number in header
            this.$el.find('[data-role=current-number]').text(index + 1);

            this.trigger('QuestionChangeStart');

            this._isAnimating = true;
            this.lockNavigation();
            this._currentQuestion = index;

            this._updateNavigation(false);

            this._transitToSlide(index);

            // Hide the full navigation
            this.$el.find('[data-role="full-navigation-holder"]').hide(0);
        },

        /**
         * Go to next question
         * @returns {*}
         */
        nextQuestion: function () {
            if (this._questions.length > 0 && this._currentQuestion >= this._questions.length - 1) {
                return this;
            } else if (this._questions.length == 0 && this._currentQuestion >= this._questions.length - 1) {
                return this;
            }

            return this.goToQuestion(this._currentQuestion + 1);
        },

        /**
         * Go to previous question
         * @returns {*}
         */
        previousQuestion: function () {
            if (this._currentQuestion <= 0) {
                return this;
            }

            return this.goToQuestion(this._currentQuestion - 1);
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

            this.$el.find('[data-role=questions-holder]').animate({
                // todo pick width some better way
                left: -this._questions[0].$el.outerWidth() * index
            }, options);
        },


        _updateNavigation: function (onlyStatus) {
            // Prev and next
            if (this._currentQuestion == 0) {
                this.$el.find('[data-role="navigation-previous"]').addClass('disabled');
            } else {
                this.$el.find('[data-role="navigation-previous"]').removeClass('disabled');
            }

            if (this._currentQuestion == this._questions.length - 1) {
                this.$el.find('[data-role="navigation-next"]').addClass('disabled');
            } else {
                this.$el.find('[data-role="navigation-next"]').removeClass('disabled');
            }

            // Numbered buttons classes
            this.$el.find('[data-role="navigation-number"]').each(_.bind(function (index, button) {
                if (this._questions[$(button).attr('data-question-index')].answerModel.isAnswered()) {
                    $(button).addClass('answered');
                } else {
                    $(button).removeClass('answered');
                }

                if (this._currentQuestion == $(button).attr('data-question-index')) {
                    $(button).addClass('current');
                } else {
                    $(button).removeClass('current');
                }
            }, this));

            // Numbered buttons line rotation
            if (!onlyStatus) {
                this.$el.find('[data-role="quick-navigation"]').animate({
                    left: -(this.$el.find('[data-role="quick-navigation"] li').outerWidth(true) * this._currentQuestion
                    + this.$el.find('[data-role="quick-navigation"] li').width() / 2) + 'px'
                }, {
                    duration: 500
                });
            }
        },


        /**
         * Retrieves data from (differently for every question type) question reply container
         * and passes it to model
         * @param questionIndex
         * @private
         */
        _submitAnswer: function (questionIndex) {
            if (questionIndex >= this._questions.length) {
                // todo filter that where calling the method instead of here
                return;
            }

            var question = this._questions[questionIndex]; // shortcut

            switch (question.questionModel.get('answertype')) {
                case 'Text':
                    question.answerModel.set('answertext', question.$el.find('[data-role="question-reply"] input').val());
                    break;
                case 'Essay':
                    //question.answerModel.set('answerlong', question.$el.find('[data-role="wysiwyg-container"]').html());
                    question.answerModel.set('answerlong', question.$el.find('[data-role="wysiwyg-container"] .froala-view').html());
                    break;
                case 'MultiChoice':
                    if (question.questionModel.get('allowmultiple') == '1') {
                        var values = [];
                        question.$el.find('[data-role="question-reply"] input:checkbox:checked').each(_.bind(function (index, item) {
                            values.push($(item).val());
                        }, this));
                        question.answerModel.set('answerselect', values);
                    } else {
                        question.answerModel.set('answerselect', [question.$el.find('[data-role="question-reply"] input:radio:checked').val() | 0]);
                    }
                    break;
                case 'Rank':
                    var ranking = {};
                    question.$el.find('[data-role="rank-option"]').each(_.bind(function (index, item) {
                        ranking[$(item).data('value')] = index;
                    }, this));
                    question.answerModel.set('answerranks', ranking);
                    break;
                case 'Empty':
                default :
                    break;
            }

            this._questions[questionIndex].answerModel.submitAnswer();
        },

        /**
         * @private
         */
        _submitAttempt: function () {
            this._attemptModel.complete({
                success: _.bind(function () {
                    window.location.href = "/studentreport?id=" + this._surveyModel.get('id') + "&attemptid=" + this._attemptModel.get('id');
                }, this)
            });
        },


        _cancelAttempt: function () {
            this._attemptModel.cancel({
                success: _.bind(function () {
                    window.location.href = "/studentreport?id=" + this._surveyModel.get('id') + "&attemptid=" + this._attemptModel.get('id');
                }, this)
            });
        },

        /**
         * Models events
         */

        /**
         * @private
         */
        _onSurveyDataLoaded: function () {
            this._bootNormalState();
        },

        /**
         * Question model managed to load another question's content
         * @param question
         * @private
         */
        _onQuestionDataLoaded: function (question) {
            this._renderQuestion(question.index);
        },

        /**
         * Server returned a newly initiated attempt
         * Now we received the attemptid and can now try to find answers previously given by user
         *
         * Ok, this can be confusing. Why the hell do we even try to find answers if we just started the session?
         * And you are right, people, this doesn't make any sense to do here, it's just I will then move this
         * functionality to _attemptLoaded
         *
         * todo check quiz options before unlocking navigation
         * @private
         */
        _onAttemptStarted: function () {
            this._bootNormalState();

            this.unlockNavigation();

            /*
             * Mind that this will always happen after all questions are initialized
             * with their question models already having ids specified. Just because Start! button is rendered in a same
             * _onSurveyDataLoaded as the questions
             */
            for (var i = 0; i < this._questions.length; i++) {
                this._questions[i].answerModel.set('attemptid', this._attemptModel.get('id'));
                this._questions[i].answerModel.fetch({
                    success: _.bind(this._onAnswerLoaded, this, this._questions[i]),
                    error: function () {
                        console.log('error loading answer', arguments);
                    }
                });
            }
        },

        _onAnswerLoaded: function (question) {
            this._renderQuestion(question.index);
        },

        /**
         * Own events
         */

        /**
         * Called when animation of questions transition is finished
         * todo check quiz settings before unlocking navigation
         * @private
         */
        _onTransitToSlideFinish: function () {
            window.scrollTo(0, 0);
            this.isAnimating = false;
            this.unlockNavigation();

            this.trigger('QuestionChangeFinish');
        },

        /**
         * Called when user changes value in question Answer input
         * @param event
         * @private
         */
        _onAnswerInputChange: function (event) {
        },

        /**
         * No idea what this can possibly be used for, but why not?
         * This method is only invoked when question is loaded in normal state (not when "loading" template is in use)
         * todo reconsider presence of this method in favor of moving it to helpers
         * @param question
         * @private
         */
        _questionPreRender: function (question) {
            this.trigger('QuestionPreRender');
        },

        /**
         * Good place to boot ckeditor or jsPlumb
         * This method is only invoked when question is loaded in normal state (not when "loading" template is in use)
         * todo reconsider presence of this method in favor of moving it to helpers
         * @param question
         * @private
         */
        _questionPostRender: function (question) {
            this.trigger('QuestionPostRender');

            if (question.questionModel.get('answertype') == "Essay") {
                // froala
                question.$el.find('[data-role="wysiwyg-container"]').editable({
                    inlineMode: false,
                    toolbarFixed: false,
                    alwaysVisible: true,
                    countCharacters: false,
                    placeholder: null,
                    minHeight: 300,
                    maxHeight: 600,
                    imageUpload: false,
                    buttons: [
                        'undo', 'redo', 'sep',
                        'bold', 'italic', 'underline', 'subscript', 'superscript', 'sep',
                        'outdent', 'indent', 'insertOrderedList', 'insertUnorderedList', 'sep',
                        'createLink', 'insertImage', 'insertVideo', 'sep',
                        'fullscreen']
                });
                /**
                 * todo initialize auto-save utility — pass data to server every dozen of seconds to make
                 * sure the content is not lost if user accidentally reloads a page of something else terrible happens
                 * todo add local storage support for autosave feature (in case internet connection drops)
                 * todo add Cmd/Ctrl+S support to allow students save current text on demand
                 * We all know there is nothing worth then to realize that you've just all the text you've been typing
                 * for half and hour for no good reason
                 * see for details https://www.youtube.com/watch?v=l2-UuIEOcss
                 */

                    // attach handler for attachment
                    // todo move to backbone's events
                question.$el.find('[name="attachment"]').on('change', _.bind(function (question, event) {
                    if (event.target.files.length) {
                        var file = event.target.files[0];
                        var nBytes = file.size;
                        var sOutput = nBytes + " bytes";
                        // optional code for multiples approximation
                        for (var aMultiples = ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"], nMultiple = 0, nApprox = nBytes / 1024; nApprox > 1; nApprox /= 1024, nMultiple++) {
                            sOutput = nApprox.toFixed(3) + " " + aMultiples[nMultiple];
                        }

                        // designate icon
                        var icon = 'file-o';
                        if (file.type.indexOf('image') > -1)
                            icon = 'file-image-o';
                        else if (file.type.indexOf('audio') > -1)
                            icon = 'file-video-o';
                        else if (file.type.indexOf('video') > -1)
                            icon = 'file-video-o';
                        else if (file.type.indexOf('pdf') > -1)
                            icon = 'file-pdf-o';
                        else if (file.type.indexOf('wordprocessingml') > -1)
                            icon = 'file-word-o';
                        else if (file.type.indexOf('presentationml') > -1)
                            icon = 'file-powerpoint-o';
                        else if (file.type.indexOf('spreadsheetml') > -1)
                            icon = 'file-excel-o';

                        // build the attachment info holder
                        question.$el.find('[data-role="attachment-holder"]').html(
                            $('<span>')
                                .append($('<i class="fa fa-' + icon + '"></i>'))
                                .append(file.name)
                                .append(' ')
                                .append(sOutput)
                        );

                        // assign to answer
                        question.answerModel.set('attachment', file);

                        // clear input
                        $(event.target).replaceWith($(event.target).val('').clone(true));
                    }
                }, this, question));
            }

            if (question.questionModel.get('answertype') == 'Rank') {
                for (var i = 0; i < question.questionModel.get('options').length; i++) {
                    question.$el.find('[data-loaded-rank="' + i + '"]').appendTo(question.$el.find('[data-role="question-reply"]'));
                }

                question.$el.find('[data-role="question-reply"]').sortable({
                    placeholder: 'placeholder'
                });
            }
        },

        /**
         * User Event handlers
         */

        _onNavigationNextClick: function (event) {
            event.preventDefault();
            if (!this._navigationLocked)
                this.nextQuestion();
        },

        _onNavigationPreviousClick: function (event) {
            event.preventDefault();
            if (!this._navigationLocked)
                this.previousQuestion();
        },

        _onNavigationNumberClick: function (event) {
            event.preventDefault();

            if (!this._navigationLocked)
                this.goToQuestion($(event.target).attr('data-question-index'));
        },

        /**
         *
         * @param event
         * @private
         */
        _onDiacriticClick: function (event) {
            event.preventDefault();
            clearTimeout(this._diacriticsContainer.timer);

            var caretPos = 0;
            if (document.selection) { // IE
                this._activeInput[0].focus();
                var range = document.selection.createRange();
                range.moveStart('character', -this._activeInput[0].value.length);
                caretPos = range.text.length;
            } else if (this._activeInput[0].selectionStart || this._activeInput[0].selectionStart == '0') { // Firefox
                caretPos = this._activeInput[0].selectionStart;
                this._activeInput[0].focus();
            }

            if ($(event.target).attr('data-role') == 'di-selector') {
                //launch function "getCaret" after finding the appropriate input field. If caret is found in field then
                //diacritic will be added at cursor, else diacritic will be added at end of text, if any.
                //sets value of input field to whatever it was WITH the appropriate diacritic AT cursor OR just at end of input if no cursor is found
                this._activeInput.val(this._activeInput.val().substring(0, caretPos) + $(event.target).attr('data-value') + (this._activeInput.val().substring(caretPos)));

                if (this._activeInput[0].createTextRange) {
                    var range = this._activeInput[0].createTextRange();
                    range.move("character", caretPos + 1);
                    range.select();
                } else if (this._activeInput[0].selectionStart != null) {
                    this._activeInput.focus();
                    this._activeInput[0].setSelectionRange(caretPos + 1, caretPos + 1);
                }
            } else { // Click in diacritics container but not on actual diacritic char button
                if (this._activeInput[0].createTextRange) {
                    var range = this._activeInput[0].createTextRange();
                    range.move("character", caretPos);
                    range.select();
                } else if (this._activeInput[0].selectionStart != null) {
                    this._activeInput.focus();
                    this._activeInput[0].setSelectionRange(caretPos, caretPos);
                }
            }
        },


        _onAttemptSubmitClick: function (event) {
            event.preventDefault();

            window.location = '/survey/results?id=' + this._surveyModel.get('id');
        },


        _onAttemptCancelClick: function (event) {
            event.preventDefault();

            window.location = '/survey/results?id=' + this._surveyModel.get('id');
        },


        _onInputFocus: function (event) {
            if ('ontouchstart' in document.documentElement)
                return; // Do not show for diacritics devices.

            this._activeInput = $(event.target);

            // In order to properly position diacritics, we need to find input's position
            // relative to .main-part which serves a positioned parent to diacritics container
            var top = 0,
                node = this._activeInput;
            do {
                top += node.position().top;
                node = node.parent();
            } while (!node.hasClass('main-part')); // todo replace check with something class independent

            this._diacriticsContainer.show();
            this._diacriticsContainer.css({
                top: (top - this._diacriticsContainer.height()) + 'px'
            });
        },

        _onInputBlur: function (event) {
            // we start a timer here, if nothing clears it, we hide dia container. dia click handler shall clear it
            this._diacriticsContainer.timer = setTimeout(_.bind(function () {
                this._diacriticsContainer.hide();
            }, this), 200);
        },

        _onFullNavigationButtonClick: function (event) {
            event.preventDefault();

            this.$el.find('[data-role="full-navigation-holder"]').toggle(0);
        },

        /**
         * Misc
         */
        diacritics: {
            // Array of special characters to use in simple text and long answer input
            lowercase: [
                'á', 'é', 'í', 'ó', 'ú',
                'à', 'è', 'ì', 'ò', 'ù',
                'â', 'ê', 'î', 'ô', 'û',
                'ä', 'ë', 'ï', 'ö', 'ü',
                'ã', 'õ', 'ñ', 'ý', 'ÿ',
                'å', 'ç', 'œ', 'ø', 'æ'
            ],
            uppercase: [
                'Á', 'É', 'Í', 'Ó', 'Ú',
                'À', 'È', 'Ì', 'Ò', 'Ù',
                'Â', 'Ê', 'Î', 'Ô', 'Û',
                'Ä', 'Ë', 'Ï', 'Õ', 'Ü',
                'Ã', 'Õ', 'Ñ', 'Ý', 'Ÿ',
                'Å', 'Ç', 'Œ', 'Ø', 'Æ'
            ],
            symbol: [
                '¿', '¡', '°', '«', '»',
                '‹', '›', '€', '¢', '£',
                '¥', 'ƒ', '¼', '½', '¾'
            ]
        }
    });

    return Survey_View;
});