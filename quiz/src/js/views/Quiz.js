define(function (require) {
    'use strict';

    // Dependencies
    var template = {
            quiz: {
                Loading: _.template(require('text!html/Quiz/Loading.html')),
                Normal: _.template(require('text!html/Quiz/Normal.html')),
                Intro: _.template(require('text!html/Quiz/Intro.html')),
                Outro: _.template(require('text!html/Quiz/Outro.html'))
            },
            question: {
                Loading: _.template(require('text!html/Question/Loading.html')),
                Empty: _.template(require('text!html/Question/Empty.html')),
                Text: _.template(require('text!html/Question/Text.html')),
                Essay: _.template(require('text!html/Question/Essay.html')),
                Matching: _.template(require('text!html/Question/Matching.html')),
                MultiChoice: _.template(require('text!html/Question/MultiChoice.html')),
                SimpleRecording: _.template(require('text!html/Question/SimpleRecording.html')),
                ComparativeRecording: _.template(require('text!html/Question/ComparativeRecording.html')),
                Cloze: _.template(require('text!html/Question/Cloze.html'))
            }
        },
        Quiz_Model = require('models/XML/Quiz'),
        Question_Model = require('models/XML/Question'),
        Attempt_Model = require('models/XML/Attempt'),
        Answer_Model = require('models/XML/Answer');
    /**
     * todo refactor the code, rearrange methods in some stricter logic
     * todo reconsider having public methods.
     * todo (PRIORITY!) forbid tabbing to invisible elements
     *
     * Life cycle:
     * Notation notices
     * Nested item will necessary happen after its parent
     * Nodes of same level except roots (1, 2, 3) may generally happen in any order (though some are instant anyway)
     * nested items with 0 as well as items in square brackets do not mean any process but just give some special notes
     *
     * 1. Quiz_View initializes:
     * 1.1. Quiz.Loading template is used to render "canvas"
     * 1.2. Quiz_Model initializes and sends a request to retrieve data
     * 1.3. Navigation is locked
     *
     * 2. _onQuizDataLoaded called from model:
     * 2.1. Intro page loaded
     * 2.1.1. Intro page contains a button to start attempt (calls _onAttemptStartClick)
     * 2.2. Question.Loading templates rendered to container
     * 2.3. EMPTY Answer_Models are initialized and assigned to questions
     * 2.4. Question_Model initialized
     * 2.4.1. Answer_Model receive question_id
     * 2.4.2. Request for question data sent to server
     * 2.4.2.1. _onQuestionDataLoaded called from every Question_Model when server returns info.
     * 2.4.2.1.0. If Answer_Model already loaded answer from server
     * 2.4.2.1.1. Question is rendered with solid template
     *
     * 3. _onAttemptStartClick called by user action
     * 3.0. [this always happens after 2 (2.1. renders the button), which means question with empty Answer_Models are already there]
     * 3.1. Answer_Model receives attempt_id
     * 3.2. [If Answer_Models contain question_ids (2.4.1 took place)]
     * 3.2.1. Answer_Model tries to retrieve answer from server
     * 3.2.1.1. _onAnswerLoaded is called
     * 3.3. Navigation is unlocked
     *
     * 4. _onAnswerLoaded is called from model
     * 4.0. [Notice that this can happen before Question data is loaded]
     * 4.1. [if question data is already loaded]
     * 4.1.1. Question is rendered
     *
     * Notice that Question rendering is called both from _onAnswerLoaded and _onQuestionDataLoaded. This has 2 reason:
     * 1. Generally we cannot be sure that student will not click Start! before all questions data is loaded though we start loading it shortly after initialization
     * 2. This leaves us possibility to rearrange procedures.
     * E.g. only start to load question data and answers after user clicks Start!
     * or the contrary — do not show Start! button before all questions and answers are loaded
     * or even start the attempt right after data and answers are loaded (e.g. for quizes without time limit)
     *
     * Notice that 3 and 4 necessary happen after 2
     */
    var Quiz_View = Backbone.View.extend({

        events: {
            'click [data-role="navigation-next"]': '_onNavigationNextClick',
            'click [data-role="navigation-previous"]': '_onNavigationPreviousClick',
            'click [data-role="navigation-number"]': '_onNavigationNumberClick',
            'click [data-role="full-navigation-button"]': '_onFullNavigationButtonClick',
            'click [data-role="audio-record-control"]': '_onAudioRecordControlClick',
            'click [data-role="diacritics-container"]': '_onDiacriticClick',
            'click [data-role="attempt-start"]': '_onAttemptStartClick',
            'click [data-role="attempt-continue"]': '_onAttemptContinueClick',
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
        _recorder: null,
        _audioContext: null,
        _quizModel: null,
        _attemptModel: null,
        _activeInput: null,
        _diacriticsContainer: null,
        _outro: null,

        /**
         *
         * @param config
         */
        initialize: function (config) {
            this.setElement(config.element);

            this.$el.html(template.quiz.Loading(this));

            this._quizModel = new Quiz_Model({id: config.quizId});

            this._quizModel.fetch({
                success: _.bind(this._onQuizDataLoaded, this),
                error: function () {
                    console.log('error loading quiz data', arguments);
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
         * Sends request to server to create an attempt
         */
        _startAttempt: function () {
            this._attemptModel.start({
                success: _.bind(this._onAttemptStarted, this),
                error: function () {
                    console.log('error loading quiz data', arguments);
                }
            });
        },

        /**
         * Almost like _startAttempt
         * @private
         */
        _continueAttempt: function () {
            this._attemptModel.fetch({
                success: _.bind(this._onAttemptStarted, this),
                error: function () {
                    console.log('error loading quiz data', arguments);
                }
            });
        },

        /**
         * Render normal template, build questions array and start loading them
         * @private
         */
        _bootNormalState: function () {
            // Render normal view and start loading questions
            this.$el.html(template.quiz.Normal(this));
            this._diacriticsContainer = this.$el.find('[data-role="diacritics-container"]');
            this._diacriticsContainer.tabs();

            // Build questions with loading template and inject them
            for (var i = 0; i < this._quizModel.get('quizquestions').length; i++) {
                var question = {
                    id: this._quizModel.get('quizquestions')[i],
                    questionModel: new Question_Model({id: this._quizModel.get('quizquestions')[i]}),
                    answerModel: new Answer_Model({questionid: this._quizModel.get('quizquestions')[i]}),
                    index: i // Index of this question in this._questions
                };

                question.answerModel.setQuestionModel(question.questionModel);

                // Add question to storage
                this._questions.push(question);

                // Render loading state
                this._renderQuestion(question.index);

                question.questionModel.fetch({
                    success: _.bind(this._onQuestionDataLoaded, this, question),
                    error: function () {
                        console.log('error loading question data', arguments);
                    }
                });
            }

            // Align navigation
            this._updateNavigation(false);

            // Add outro screen
            var outro = $(template.quiz.Outro(this))
            this.$el.find('[data-role="questions-holder"]').append(outro);
            outro.css({
                width: this.$el.find('[data-role="questions-container"]').width() + 'px'
            });
            this._outro = {
                $el: outro
            }
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
                this._updateSummary();
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
            if (isNaN(index)) return ;// Quick hack for navigation button
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
                if (this._questions.length == $(button).attr('data-question-index')) return;

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


        _updateSummary: function () {
            // Collect skipped questions
            var skippedQuestions = [];
            for (var i = 0; i < this._questions.length; i++) {
                if (!this._questions[i].answerModel.isAnswered()) {
                    skippedQuestions.push(this._questions[i]);
                }
            }
            if (skippedQuestions.length) {
                this.$el.find('[data-role="unanswered-container"]')
                    .empty()
                    .append($('<h1>Skipped Questions</h1>'));
                for (var i = 0; i < skippedQuestions.length; i++) {
                    $('<p>')
                        .html('<span>Question ' + (skippedQuestions[i].index + 1) + ':</span><span data-role="navigation-number" data-question-index="' + skippedQuestions[i].index + '"> ' + skippedQuestions[i].questionModel.get('name') + '</span>')
                        .appendTo(this.$el.find('[data-role="unanswered-container"]'));
                }
            } else {
                this.$el.find('[data-role="unanswered-container"]').html($('<h1>All question are answered.</h1>'));
            }
        },


        _updateTimer: function () {
            var secondsLeft = this._quizModel.get('timelimit') * 1 - (new Date().getTime() / 1000 - this._attemptModel.get('started') * 1),
                hourMark = Math.floor(secondsLeft / 60 / 60),
                minuteMark = Math.floor(secondsLeft % (60 * 60) / 60),
                secondMark = Math.floor(secondsLeft % 60);

            minuteMark = minuteMark < 10 ? '0' + minuteMark : minuteMark;
            secondMark = secondMark < 10 ? '0' + secondMark : secondMark;

            if (secondsLeft > 60 * 60) {
                this.$el.find('[data-role="timer"]').text(hourMark + ':' + minuteMark + ':' + secondMark);
            } else if (secondsLeft > 0) {
                this.$el.find('[data-role="timer"]').text(minuteMark + ':' + secondMark);

                if (secondsLeft < 60 * 5 && secondsLeft >= 60) {
                    this.$el.find('[data-role="timer"]').addClass('time-warning');
                } else if (secondsLeft < 60) {
                    this.$el.find('[data-role="timer"]').addClass('time-alert');
                }
            } else if (secondsLeft < 0) {
                // todo submit current question
                // todo auto-submit at least a second before actual time finish
                this._submitAttempt();
            } else {
                // erhm?
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
                    question.answerModel.set('answershort', question.$el.find('[data-role="question-reply"] input').val());
                    break;
                case 'Essay':
                    //question.answerModel.set('answerlong', question.$el.find('[data-role="wysiwyg-container"]').html());
                    question.answerModel.set('answerlong', question.$el.find('[data-role="wysiwyg-container"] .froala-view').html());
                    break;
                case 'MultiChoice':
                    question.answerModel.set('answerselectid', question.$el.find('[data-role="question-reply"] input:radio:checked').val() | 0);
                    break;
                case 'Cloze':
                    var answers = [];
                    question.$el.find('[data-role="question-reply"] :input').each(_.bind(function (index, element) {
                        var subAnswerModel = question.answerModel.getSubAnswerByQuestionId($(element).attr('name'));
                        if (element.nodeName.toLowerCase() == 'select') {
                            subAnswerModel.set('answerselectid', $(element).val());
                        }
                        // todo check if not only input type="text" but other types as well
                        if (element.nodeName.toLowerCase() == 'input') {
                            subAnswerModel.set('answershort', $(element).val());
                        }
                    }, this));
                    break;
                case 'Matching':
                    var matches = {};
                    question.$el.find('[data-role="matching-left-column"] div').each(function () {
                        var connections = question.jsPlumb.getConnections({source: this});
                        if (connections.length) {
                            matches[$(this).data('value')] = $(connections[0].target).data('value');
                        }
                    });
                    question.answerModel.set('answermatchings', matches);
                    break;
                case 'SimpleRecording':
                case 'ComparativeRecording':
                    break;
                case 'Empty':
                default :
                    break;
            }

            this._questions[questionIndex].answerModel.submitAnswer();

            // todo update summary when answered is received by server
            this._updateSummary();
        },

        /**
         * @private
         */
        _submitAttempt: function () {
            this._attemptModel.complete({
                success: _.bind(function () {
                    window.location.href = "/studentreport?id=" + this._quizModel.get('id') + "&attemptid=" + this._attemptModel.get('id');
                }, this)
            });
        },


        _cancelAttempt: function () {
            this._attemptModel.cancel({
                success: _.bind(function () {
                    window.location.href = "/studentreport?id=" + this._quizModel.get('id') + "&attemptid=" + this._attemptModel.get('id');
                }, this)
            });
        },

        /**
         * Models events
         */

        /**
         * @private
         */
        _onQuizDataLoaded: function () {
            // Init attempt with available data (data retrieved from XmlQuiz service)
            if (this._quizModel.get('attemptid') * 1) {
                this._attemptModel = new Attempt_Model({id: this._quizModel.get('attemptid')});
            } else {
                this._attemptModel = new Attempt_Model({quizId: this._quizModel.get('id')});
            }

            // Add intro page
            this.$el.html(template.quiz.Intro(this));
        },

        /**
         * Question model managed to load another question's content
         * @param question
         * @private
         */
        _onQuestionDataLoaded: function (question) {
            this._renderQuestion(question.index);

            // Init audio recorder
            if (!this._recorder && (question.questionModel.get('answertype') == "SimpleRecorder"
                || question.questionModel.get('answertype') == "ComparativeRecording")) {
                navigator.getUserMedia = navigator.getUserMedia ||
                    navigator.webkitGetUserMedia ||
                    navigator.mozGetUserMedia ||
                    navigator.msGetUserMedia;

                window.AudioContext = window.AudioContext ||
                    window.webkitAudioContext ||
                    window.mozAudioContext ||
                    window.msAudioContext;

                if (navigator.getUserMedia) {
                    navigator.getUserMedia({
                        audio: true
                    }, _.bind(function (stream) {
                        // success
                        this._audioContext = new window.AudioContext;
                        var source = this._audioContext.createMediaStreamSource(stream);
                        this._recorder = new Recorder(source, {
                            workerPath: '/bower_components/Recorderjs/recorderWorker.js',
                            numChannels: 1
                        });
                    }, this), _.bind(function () {
                        // error
                    }, this));
                } else {
                    alert('Your browser doesn\'t support audio stream recording so you won\'t be able to complete Simple recorder and Compoarative recorder questions which are present in this quiz');
                }
            }
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

            // Init timed execution for timer
            if (this._quizModel.get('timelimit') * 1) {
                setInterval(_.bind(this._updateTimer, this), 1000);
            }

            /*
             * Mind that this will always happen after all questions are initialized
             * with their question models already having ids specified. Just because Start! button is rendered in a same
             * _onQuizDataLoaded as the questions
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
         * Good place to boot froala or jsPlumb
         * This method is only invoked when question is loaded in normal state (not when "loading" template is in use)
         * todo reconsider presence of this method in favor of moving it to helpers
         * @param question
         * @private
         */
        _questionPostRender: function (question) {
            this.trigger('QuestionPostRender');

            if (question.questionModel.get('answertype') == "Essay") {
                // invoke froala in question.$el
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
                        'diacritics', 'sep',
                        'color', 'sep',
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

            /**
             * todo bind events through backbone View events
             */
            if (question.questionModel.get('answertype') == "Matching") {
                question.jsPlumb = jsPlumb.getInstance();
                question.jsPlumb.setContainer(question.$el.find('[data-role="question-reply"]'));
                // wait for image load events and repaint
                question.$el.find('img').bind('load', _.bind(function(jsPlumbInstance){
                    jsPlumbInstance.repaintEverything();
                }, this, question.jsPlumb))
                // load existing connections (from previous session)
                var matches = question.answerModel.get('answermatchings'); // shortcut
                for (var left in matches) {
                    question.jsPlumb.connect({
                        source: question.$el.find('[data-role="matching-left-column"] [data-value="' + left + '"]'),
                        target: question.$el.find('[data-role="matching-right-column"] [data-value="' + matches[left] + '"]'),
                        anchors: ["Right", "Left"],
                        endpoint: "Blank"
                    });
                }

                // bind events
                question.$el.find('[data-role="matching-left-column"] > div').on('click.quiz-matching', _.bind(function (question, event) {
                    event.stopPropagation(); // without it, event we are binding on this.$el will trigger immediately
                    // todo do not assign class, assign data-attribute
                    $(event.currentTarget).addClass('active');
                    question.jsPlumb.detachAllConnections($(event.currentTarget));
                    this.$el.trigger('click.quiz-matching'); // trigger click to make sure first click is reset if second click also lands to left column element
                    this.$el.one('click.quiz-matching', _.bind(function (question, leftElement, event) {
                        leftElement.removeClass('active');
                        var rightElement = $(event.target).closest('[data-role="matching-right-column"] > div');
                        if (!rightElement.length) {
                            return;
                        }

                        question.jsPlumb.detachAllConnections(rightElement);

                        question.jsPlumb.connect({
                            source: leftElement,
                            target: rightElement,
                            anchors: ["Right", "Left"],
                            endpoint: "Blank"
                        });
                    }, this, question, $(event.currentTarget)));
                }, this, question));
            }

            // todo rework this logic to contain no html generation/replacement
            // todo create a helper that will be passed to template to be used to replace the marks
            if (question.questionModel.get('answertype') == 'Cloze') {
                var clozeText = question.questionModel.get('cloze');
                var marks = clozeText.match(/\{([^\}]+)\}/g);
                for (var i = 0; i < marks.length; i++) {
                    var subQuestionModel = question.questionModel.getSubQuestion(marks[i].replace(/\D/g, ''));
                    if (!subQuestionModel) continue; // If question couldn't load, skip it.
                    var subAnswer = question.answerModel.getSubAnswerByQuestionId(subQuestionModel.get('id'));
                    if (subQuestionModel.get('answertype') == "Text") {
                        var subQuestion = $('<input>');
                        subQuestion.attr('type', 'text');
                        subQuestion.attr('name', subQuestionModel.get('id'));
                        subQuestion.attr('value', subAnswer.get('answershort'));
                        clozeText = clozeText.replace(marks[i], subQuestion.get(0).outerHTML);
                    } else if (subQuestionModel.get('answertype') == "MultiChoice") {
                        var subQuestion = $('<select>');
                        subQuestion.attr('name', subQuestionModel.get('id'));
                        for (var k = 0; k < subQuestionModel.get('questionselect').length; k++) {
                            var option = $('<option>')
                            option.attr('value', subQuestionModel.get('questionselect')[k].id);
                            option.text(subQuestionModel.get('questionselect')[k].value)
                            if (subAnswer && subAnswer.get('answerselectid') == subQuestionModel.get('questionselect')[k].id) {
                                option.attr('selected', true);
                            }
                            subQuestion.append(option);
                        }
                        clozeText = clozeText.replace(marks[i], subQuestion.get(0).outerHTML);
                    }
                }
                question.$el.find('[data-role="question-reply"]').html(clozeText);
            }
        },

        /**
         * User Event handlers
         */

        _onAttemptStartClick: function (event) {
            event.preventDefault();

            this._startAttempt();
        },

        _onAttemptContinueClick: function (event) {
            event.preventDefault();

            this._continueAttempt();
        },

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

        /**
         *
         * @param event
         * @private
         */
        _onAudioRecordControlClick: function (event) {
            event.preventDefault();

            if ($(event.target).attr('disabled')) {
                return;
            }

            var question = $(event.target).closest('[data-role="question"]').data('question');
            switch ($(event.target).attr('data-control-type')) {
                case 'start':
                    this.lockNavigation();
                    // Start recording
                    this._recorder.clear();
                    this._recorder.record();
                    if (question.$el.find('[data-role="comparator-template"]').length) {
                        question.$el.find('[data-role="comparator-template"]').get(0).currentTime = 0;
                        question.$el.find('[data-role="comparator-template"]').get(0).play();
                    }
                    // Apply state for buttons
                    question.$el.find('[data-role="audio-record-control"]').attr('disabled', true);
                    question.$el.find('[data-role="audio-record-control"][data-control-type="stop"]').attr('disabled', false);
                    break;
                case 'stop':
                    // Stop recording
                    this._recorder.stop();
                    if (question.$el.find('[data-role="comparator-template"]').length) {
                        question.$el.find('[data-role="comparator-template"]').get(0).pause();
                    }
                    // Apply state to buttons
                    question.$el.find('[data-role="audio-record-control"]').attr('disabled', true);
                    // Export recording to preview and answer
                    this._recorder.exportWAV(_.bind(function (soundBlob) {
                        question.$el.find('[data-role="preview-container"]').empty().append(
                            $('<audio>')
                                .attr('src', URL.createObjectURL(soundBlob))
                                .attr('controls', 'controls')
                        );
                        question.answerModel.set('record', soundBlob);
                        this.unlockNavigation();
                        // Apply state to buttons
                        question.$el.find('[data-role="audio-record-control"]').attr('disabled', false);
                        question.$el.find('[data-role="audio-record-control"][data-control-type="stop"]').attr('disabled', true);
                    }, this));
                    break;
            }
        },


        _onAttemptToSummaryClick: function (event) {
            event.preventDefault();

            this.goToQuestion(this._questions.length);
        },


        _onAttemptSubmitClick: function (event) {
            event.preventDefault();

            this._submitAttempt();
        },


        _onAttemptCancelClick: function (event) {
            event.preventDefault();

            if (confirm('Are you sure you want to cancel your attempt?')) {
                this._cancelAttempt();
            }
        },


        _onInputFocus: function (event) {
            if ('ontouchstart' in document.documentElement)
                return; // Do not show for touch devices.

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
                top: (top + $(event.target).outerHeight()) + 'px'
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

    return Quiz_View;
});